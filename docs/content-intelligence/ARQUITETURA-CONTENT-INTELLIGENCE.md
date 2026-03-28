# Arquitetura Técnica: Content Intelligence Pipeline

> Versão: 1.0 — 2026-03-28
> Referência: PLANO-CONTENT-INTELLIGENCE.md (visão de produto)
> Este documento: especificação técnica de implementação

---

## 1. Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS Hostinger                             │
│                                                              │
│  Componente 1: claw-kb CLI                                  │
│  /root/.openclaw/tools/claw-kb/                             │
│  TypeScript nativo (Node 22 --experimental-strip-types)     │
│  better-sqlite3                                             │
│  ├── src/                                                   │
│  │   ├── index.ts          (entry point)                    │
│  │   ├── db.ts             (schema, conexão, migrations)    │
│  │   ├── types.ts          (interfaces e enums)             │
│  │   ├── output.ts         (formatação JSON padronizada)    │
│  │   ├── validators.ts     (validação de inputs)            │
│  │   └── commands/                                          │
│  │       ├── source.ts                                      │
│  │       ├── article.ts                                     │
│  │       ├── rec.ts                                         │
│  │       ├── pub.ts                                         │
│  │       ├── analysis.ts   (crossref, gaps, digest)         │
│  │       └── maintenance.ts (stats, prune, export, import)  │
│  ├── package.json                                           │
│  ├── seed.ts               (popular fontes iniciais)        │
│  └── test.ts               (validação de todos os comandos) │
│                                                              │
│  Componente 2: Skills OpenClaw                               │
│  /root/.openclaw/workspace/skills/                          │
│  ├── content-scout/                                         │
│  │   ├── SKILL.md                                           │
│  │   └── references/                                        │
│  │       ├── scoring-system.md                              │
│  │       └── sources-config.md                              │
│  ├── content-advisor/                                       │
│  │   ├── SKILL.md                                           │
│  │   └── references/                                        │
│  │       └── projetos-gabriel.md                            │
│  ├── content-recommender/                                   │
│  │   ├── SKILL.md                                           │
│  │   └── references/                                        │
│  │       ├── projetos-gabriel.md                            │
│  │       ├── format-templates.md                            │
│  │       └── notebooklm-template.md                         │
│  ├── content-summarizer/    (existente, sem mudanças)       │
│  └── feedback-loop/         (existente, sem mudanças)       │
│                                                              │
│  Componente 3: Cron Jobs                                     │
│  6 jobs configurados via openclaw cron add                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Componente 1: `claw-kb` CLI

### 2.1 Stack

| Item | Escolha | Motivo |
|------|---------|--------|
| Runtime | Node.js 22.22.1 (já na VPS) | Zero instalação adicional |
| Linguagem | TypeScript nativo | `--experimental-strip-types` no Node 22, sem build step |
| Database | better-sqlite3 | Sync, performático, zero config, types TS excelentes |
| CLI parser | parseArgs (nativo do Node) | Zero dependência externa, suficiente pra CLI simples |
| Dependências | Apenas `better-sqlite3` | Mínimo possível |

### 2.2 Interfaces TypeScript

```typescript
// ===== types.ts =====

// --- Enums ---

export type Priority = 'P0' | 'P1' | 'P2';
export type SourceType = 'rss' | 'blog' | 'youtube' | 'newsletter';
export type Frequency = 'daily' | '3x-week' | 'weekly';
export type ContentType = 'article' | 'video' | 'paper' | 'post' | 'newsletter-issue';
export type Category = 'ai' | 'tech' | 'negocios' | 'carreira' | 'marketing' | 'tools';
export type ArticleStatus = 'ingested' | 'cataloged' | 'analyzed' | 'recommended' | 'used' | 'skipped';
export type RecStatus = 'pending' | 'approved' | 'published' | 'rejected';
export type RecFormat = 'linkedin-post' | 'twitter-thread' | 'article' | 'newsletter' | 'video-short';
export type RecPriority = 'high' | 'medium' | 'low';
export type Platform = 'linkedin' | 'twitter' | 'newsletter' | 'blog' | 'youtube';

// --- Entities ---

export interface Source {
  id: number;
  name: string;
  type: SourceType;
  url: string | null;
  priority: Priority;
  frequency: Frequency;
  enabled: boolean;
  last_checked_at: string | null;
  created_at: string;
}

export interface Article {
  id: number;
  source_id: number;
  url: string;
  title: string;
  content_type: ContentType;
  category: Category | null;
  tags: string[];                    // armazenado como JSON string no SQLite
  summary: string | null;            // resumo curto do feed (scout)
  full_summary: string | null;       // resumo completo (recommender, após leitura)
  key_points: string[];              // armazenado como JSON string no SQLite
  relevance: number;                 // 0-10
  relevance_breakdown: RelevanceBreakdown | null;
  has_tool: boolean;
  tool_name: string | null;
  tool_repo: string | null;
  status: ArticleStatus;
  ingested_at: string;
  published_at: string | null;       // data original do conteúdo
}

export interface Recommendation {
  id: number;
  article_ids: number[];             // JSON array
  theme: string;
  title: string;
  format: RecFormat;
  hook: string;
  angle: string;
  key_points: string[];              // JSON array
  quotes: string[];                  // JSON array
  target_audience: string | null;
  related_projects: string[];        // JSON array
  cross_ref: string | null;
  priority: RecPriority;
  status: RecStatus;
  created_at: string;
}

export interface Publication {
  id: number;
  platform: Platform;
  title: string;
  url: string | null;
  topics: string[];                  // JSON array
  published_at: string;
  recommendation_id: number | null;
  created_at: string;
}

// --- Scoring ---

export interface ScoreCriterion {
  matched: string | boolean | null;  // o que matchou (projeto, provider, etc) ou true/false
  points: number;
}

export interface RelevanceBreakdown {
  relevance: number;
  breakdown: {
    projeto_direto: ScoreCriterion;
    ferramenta_integravel: ScoreCriterion;
    provider_relevante: ScoreCriterion;
    tema_publicavel: ScoreCriterion;
    dados_concretos: ScoreCriterion;
    opiniao_qualificada: ScoreCriterion;
    tendencia_emergente: ScoreCriterion;
    conteudo_introdutorio: ScoreCriterion;
    noticia_requentada: ScoreCriterion;
    hype_sem_substancia: ScoreCriterion;
    fora_de_escopo: ScoreCriterion;
  };
}

// --- CLI Output ---

export interface CLISuccess<T = unknown> {
  ok: true;
  command: string;
  count?: number;
  data: T;
}

export interface CLIError {
  ok: false;
  command: string;
  code: ErrorCode;
  error: string;
}

export type CLIResult<T = unknown> = CLISuccess<T> | CLIError;

export type ErrorCode =
  | 'DUPLICATE_URL'
  | 'NOT_FOUND'
  | 'INVALID_RELEVANCE'
  | 'INVALID_PRIORITY'
  | 'INVALID_STATUS'
  | 'INVALID_JSON'
  | 'INVALID_FORMAT'
  | 'MISSING_REQUIRED'
  | 'INVALID_DATE'
  | 'DB_ERROR';
```

### 2.3 Módulos

#### `db.ts` — Database

```typescript
// Responsabilidades:
// - Abrir/criar banco em /root/.openclaw/tools/claw-kb/content.db
// - Executar schema (CREATE TABLE IF NOT EXISTS)
// - Expor instância do DB tipada
// - Migrations futuras (versão do schema em user_version pragma)

import Database from 'better-sqlite3';
import { join } from 'node:path';

const DB_PATH = join(import.meta.dirname, 'content.db');

export function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');          // performance
  db.pragma('foreign_keys = ON');           // integridade referencial
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number;

  if (version < 1) {
    db.exec(SCHEMA_V1);                    // CREATE TABLE statements
    db.pragma('user_version = 1');
  }
  // Futuras migrations: if (version < 2) { ... }
}
```

#### `validators.ts` — Validação de inputs

```typescript
// Responsabilidades:
// - Validar cada campo antes de gravar
// - Retornar ErrorCode específico em caso de falha
// - Parsear e validar JSON arrays (tags, key_points, etc)

// Validações implementadas:
// - relevance: integer 0-10
// - priority: P0 | P1 | P2 (sources) ou high | medium | low (recs)
// - status: valor válido pro tipo de entidade
// - url: não vazio, formato básico
// - json arrays: parseable, é array
// - dates: ISO 8601 básico (YYYY-MM-DD)
// - required fields: não nulos/vazios
```

#### `output.ts` — Formatação padronizada

```typescript
// Todas as respostas passam por aqui
// Garante formato consistente pro agente parsear

export function success<T>(command: string, data: T, count?: number): CLISuccess<T> {
  return { ok: true, command, ...(count !== undefined && { count }), data };
}

export function error(command: string, code: ErrorCode, message: string): CLIError {
  return { ok: false, command, code, error: message };
}

// stdout sempre recebe JSON.stringify do resultado
// stderr fica limpo (sem logs de debug)
```

#### `commands/source.ts`

```typescript
// Comandos: add, list, check, disable, enable

// source add
//   Params obrigatórios: --name, --type, --url, --priority, --frequency
//   Validações: name único, type válido, priority válida
//   Retorna: Source criada

// source list
//   Params opcionais: --priority, --enabled
//   Retorna: Source[]

// source check
//   Params: --name
//   Ação: UPDATE last_checked_at = datetime('now') WHERE name = ?
//   Retorna: { name, last_checked_at }

// source disable / enable
//   Params: --name
//   Ação: UPDATE enabled = 0/1 WHERE name = ?
//   Retorna: { name, enabled }
```

#### `commands/article.ts`

```typescript
// Comandos: add, exists, update, list, search, stats, get

// article add
//   Params obrigatórios: --url, --title, --source (nome), --content-type
//   Params opcionais: --category, --tags (JSON), --published-at
//   Validações: URL único (UNIQUE constraint), source existe, content-type válido
//   Retorna: Article criado (com source_id resolvido pelo nome)

// article exists
//   Params: --url
//   Retorna: { exists: boolean, id: number | null }
//   Uso: dedup check rápido pelo scout

// article update
//   Params: --id (obrigatório), demais opcionais
//   Campos atualizáveis: status, summary, full-summary, key-points, relevance,
//     relevance-breakdown, has-tool, tool-name, tool-repo, category, tags
//   Validações: id existe, relevance 0-10, status válido, JSON arrays válidos
//   Retorna: Article atualizado

// article list
//   Filtros opcionais: --status, --category, --since (date), --min-relevance, --limit (default 20)
//   Ordenação: ingested_at DESC
//   Retorna: Article[] (sem full_summary pra economizar output — usar get pra detalhe)

// article search
//   Params: --query
//   Busca FTS em title + summary
//   Implementação: LIKE '%query%' (simples) ou FTS5 se volume justificar
//   Retorna: Article[]

// article stats
//   Sem params
//   Retorna: { by_status: {...}, by_category: {...}, by_source: {...}, total: N }

// article get
//   Params: --id
//   Retorna: Article completo com todos os campos (incluindo full_summary, breakdown)
```

#### `commands/rec.ts`

```typescript
// Comandos: add, list, update, detail

// rec add
//   Params obrigatórios: --title, --theme, --format, --hook, --angle, --key-points (JSON), --article-ids (JSON)
//   Params opcionais: --quotes (JSON), --priority, --related-projects (JSON), --cross-ref, --target-audience
//   Validações: article_ids existem, format válido, JSON arrays válidos
//   Retorna: Recommendation criada

// rec list
//   Filtros opcionais: --status, --priority, --since
//   Retorna: Recommendation[] (resumido: id, title, theme, format, priority, status, created_at)

// rec update
//   Params: --id, --status
//   Validações: id existe, status válido (pending → approved → published | rejected)
//   Retorna: Recommendation atualizada

// rec detail
//   Params: --id
//   Retorna: Recommendation completa + Articles expandidos (JOIN com articles pelos article_ids)
```

#### `commands/pub.ts`

```typescript
// Comandos: add, list, topics

// pub add
//   Params obrigatórios: --platform, --title, --topics (JSON), --published-at
//   Params opcionais: --url, --recommendation-id
//   Validações: platform válida, date válida, recommendation_id existe (se fornecido)
//   Retorna: Publication criada

// pub list
//   Filtros opcionais: --platform, --since
//   Retorna: Publication[]

// pub topics
//   Sem params
//   Retorna: { topic: string, count: number }[] ordenado por count DESC
//   Implementação: extrair de JSON arrays, agrupar e contar
```

#### `commands/analysis.ts`

```typescript
// Comandos: crossref, gaps, digest

// crossref
//   Params: --article-id
//   Lógica:
//     1. Buscar article pelo id → extrair tags e category
//     2. Buscar publications cujos topics intersectam com tags do article
//     3. Retorna: { article: Article, related_publications: Publication[] }
//   Implementação: como topics/tags são JSON arrays em TEXT, fazer parse e
//     comparação em JS (não em SQL). Volume é baixo, performance não é problema.

// gaps
//   Params opcionais: --days (default 30)
//   Lógica:
//     1. Buscar todas as categories/tags de articles ingeridos nos últimos N dias
//     2. Buscar todas os topics de publications nos últimos N dias
//     3. Retorna categorias/tags com artigos mas sem publicação recente
//   Retorna: { category: string, articles_count: number, last_published: string | null }[]

// digest
//   Params opcionais: --since (default "yesterday"), --priority
//   Lógica:
//     1. Buscar articles ingeridos desde a data, opcionalmente filtrados por priority da source
//     2. Agrupar por status
//     3. Retorna: { period, total, by_status, by_category, top_articles (relevance DESC, limit 5) }
```

#### `commands/maintenance.ts`

```typescript
// Comandos: stats, prune, export, import

// stats
//   Dashboard geral: total de cada tabela, artigos por status, recs pendentes, última execução
//   Retorna: { sources: N, articles: {...}, recommendations: {...}, publications: N }

// prune
//   Params: --older-than (ex: "90d"), --status (ex: "skipped")
//   Validações: status obrigatório (nunca deletar sem filtro de status)
//   Ação: DELETE FROM articles WHERE status = ? AND ingested_at < ?
//   Retorna: { deleted: N }

// export
//   Params: --format json
//   Retorna: dump completo de todas as tabelas como JSON

// import
//   Params: --file
//   Ação: lê JSON, insere em transação. Conflitos de URL → skip.
//   Retorna: { imported: { sources: N, articles: N, ... }, skipped: N }
```

### 2.4 Entry Point (`index.ts`)

```typescript
// Parsing de argumentos com parseArgs nativo do Node
// Roteamento: claw-kb <entity> <action> [--flags]
//
// Exemplos:
//   claw-kb source add --name "anthropic-blog" --type rss --url "..." --priority P1 --frequency "3x-week"
//   claw-kb article list --status cataloged --since 2026-03-25 --min-relevance 7
//   claw-kb rec detail --id 3
//
// Estrutura do parsing:
//   args[0] = entity (source, article, rec, pub, crossref, gaps, digest, stats, prune, export, import)
//   args[1] = action (add, list, update, etc) — ou omitido pra comandos diretos (stats, digest)
//   --flags = parâmetros específicos do comando
//
// Output: JSON em stdout. Sempre. Sem exceção.
// Erros: JSON em stdout (com ok: false). Exit code 1.
// Nenhum output em stderr (pra não poluir o que o agente parseia).

import { parseArgs } from 'node:util';

const args = process.argv.slice(2);
const entity = args[0];
const action = args[1];

// Router
switch (entity) {
  case 'source':  handleSource(action, args.slice(2)); break;
  case 'article': handleArticle(action, args.slice(2)); break;
  case 'rec':     handleRec(action, args.slice(2)); break;
  case 'pub':     handlePub(action, args.slice(2)); break;
  case 'crossref': handleCrossref(args.slice(1)); break;
  case 'gaps':     handleGaps(args.slice(1)); break;
  case 'digest':   handleDigest(args.slice(1)); break;
  case 'stats':    handleStats(); break;
  case 'prune':    handlePrune(args.slice(1)); break;
  case 'export':   handleExport(args.slice(1)); break;
  case 'import':   handleImport(args.slice(1)); break;
  default:         printUsage(); break;
}
```

### 2.5 Execução

```bash
# O agente chama via exec no OpenClaw:
claw-kb article list --status cataloged --since 2026-03-25

# Que na VPS resolve para:
node --experimental-strip-types /root/.openclaw/tools/claw-kb/src/index.ts article list --status cataloged --since 2026-03-25

# Pra simplificar, criar symlink ou alias:
ln -s /root/.openclaw/tools/claw-kb/run.sh /usr/local/bin/claw-kb

# run.sh:
#!/bin/bash
exec node --experimental-strip-types /root/.openclaw/tools/claw-kb/src/index.ts "$@"
```

### 2.6 Testes (`test.ts`)

```typescript
// Script que valida todos os comandos em sequência.
// Cria banco temporário, executa operações, verifica outputs.
//
// Cobertura:
// 1. Source: add → list → check → disable → enable
// 2. Article: add → exists (true) → exists (false) → update → list → search → stats → get
// 3. Article: add duplicada → espera DUPLICATE_URL
// 4. Article: update relevance 15 → espera INVALID_RELEVANCE
// 5. Rec: add → list → update → detail
// 6. Pub: add → list → topics
// 7. Analysis: crossref → gaps → digest
// 8. Maintenance: stats → export → prune → import
//
// Executar: node --experimental-strip-types test.ts
// Resultado: lista de checks com PASS/FAIL
```

---

## 3. Componente 2: Skills OpenClaw

### 3.1 Skill `content-scout`

```markdown
---
name: content-scout
description: "Ingerir conteúdo de fontes curadas (blogs, newsletters, YouTube),
aplicar scoring de relevância, e catalogar no banco via claw-kb CLI. Ativar
quando um cron job pedir verificação de fontes ou quando o usuário pedir
'verifica as fontes', 'o que tem de novo', 'roda o scout', 'scout P0/P1/P2'."
---

# Content Scout — Ingestão e Classificação

Você é responsável por varrer fontes de conteúdo e catalogar o que encontrar.
Você NÃO lê artigos completos. Trabalha apenas com título e excerpt/descrição.

## Ferramentas necessárias

- `exec`: para chamar `claw-kb` CLI
- `web_fetch`: para acessar fontes

## Fluxo

### 1. Determinar prioridade

Se veio de cron, a prioridade está no prompt ("fontes P0", "fontes P1", "fontes P2").
Se veio do Gabriel sem especificar, verificar todas as habilitadas.

### 2. Listar fontes

```
exec: claw-kb source list --enabled [--priority P0]
```

### 3. Para cada fonte

a) Usar `web_fetch` na URL da fonte
b) Extrair do resultado: lista de itens com título, URL, e excerpt/descrição curta
c) Para cada item:

**Dedup:**
```
exec: claw-kb article exists --url "<url>"
```
Se `exists: true` → pular.

**Cadastrar:**
```
exec: claw-kb article add --url "<url>" --title "<titulo>" --source "<nome-fonte>" --content-type "<tipo>" [--category "<cat>"] [--published-at "<data>"]
```

**Aplicar scoring:**
Ler o arquivo de referência:
`/root/.openclaw/workspace/skills/content-scout/references/scoring-system.md`

Avaliar CADA critério do scoring system com base no título + excerpt.
Montar o breakdown JSON com os pontos de cada critério.
Calcular score final (soma, clamp 0-10).

**Atualizar artigo com score:**

Se score 0-4:
```
exec: claw-kb article update --id <N> --status skipped --relevance <score> --relevance-breakdown '<json>'
```

Se score 5-6:
```
exec: claw-kb article update --id <N> --status ingested --relevance <score> --relevance-breakdown '<json>'
```

Se score 7+:
```
exec: claw-kb article update --id <N> --status cataloged --relevance <score> --relevance-breakdown '<json>' --summary "<resumo 2-3 frases extraído do excerpt>"  --tags '<json>'
```

### 4. Atualizar timestamp da fonte

```
exec: claw-kb source check --name "<nome-fonte>"
```

### 5. Scout report

Ao final, buscar digest:
```
exec: claw-kb digest --since yesterday
```

**SE há itens com score >= 8**, enviar no Telegram:

```
Scout — DD/MM

Ingeri X itens de Y fontes.

Score 8+:
- [Fonte] "Título" — tags (score: N)
- [Fonte] "Título" — tags (score: N)

Total: X novos | Y catalogados | Z descartados

Advisor roda às 10h com esses dados.
```

**SE não há nada com score >= 8**, não enviar nada. Log silencioso.

## Regras

1. NUNCA ler artigo completo com web_fetch. Trabalhar só com título + excerpt.
2. SEMPRE aplicar o scoring system completo. Não chutar números.
3. SEMPRE salvar o breakdown (auditoria).
4. Processar TODAS as fontes da prioridade pedida, mesmo que as primeiras não tenham novidade.
5. Se web_fetch falhar numa fonte, logar e continuar com a próxima.
6. Idioma do output: PT-BR.
```

### 3.2 Arquivo de referência: `scoring-system.md`

```markdown
# Scoring System de Relevância

O Gabriel é Head de AI / AI Consultant. Ele trabalha com:
- 11 agentes Qwen em produção
- Conciliação bancária automatizada
- Programa educacional "Construa Sua Carreira"
- Marca pessoal / posicionamento como autoridade em AI
- OpenClaw como plataforma de automação

Providers que ele usa ativamente: Anthropic/Claude, Google/Gemini, Alibaba/Qwen

## Critérios positivos

| Critério | Pontos | Quando aplicar |
|----------|--------|----------------|
| Projeto direto | +3 | Título/excerpt menciona tema central de um dos projetos acima |
| Ferramenta integrável | +2 | Repo, CLI, API, framework que pode ser integrado à stack do Gabriel |
| Provider relevante | +2 | Breaking news de Anthropic, Google/Gemini, ou Alibaba/Qwen |
| Tema publicável | +2 | Assunto onde Gabriel pode agregar opinião original baseada em experiência real |
| Dados concretos | +1 | Contém benchmarks, métricas, case studies quantitativos |
| Opinião qualificada | +1 | Análise de alguém reconhecido, não só notícia factual |
| Tendência emergente | +1 | Tema apareceu em 2+ fontes nos últimos 7 dias |

## Critérios negativos

| Critério | Pontos | Quando aplicar |
|----------|--------|----------------|
| Conteúdo introdutório | -2 | Tutorial básico, "o que é X", conceitos que Gabriel já domina |
| Notícia requentada | -3 | Mesmo fato já ingerido por outra fonte, sem ângulo novo |
| Hype sem substância | -2 | Buzzwords sem informação acionável, dados, ou insight técnico |
| Fora de escopo | -5 | Sem relação com AI, tech, negócios, carreira, ou marketing |

## Cálculo

score = soma(positivos) + soma(negativos)
score = max(0, min(10, score))

## Breakdown JSON

Para CADA critério, registrar:
- matched: o que matchou (ex: "agentes-qwen", "anthropic", true) ou null/false se não matchou
- points: pontos atribuídos (0 se não matchou)
```

### 3.3 Skill `content-advisor`

```markdown
---
name: content-advisor
description: "Analisar artigos catalogados pelo scout, deduplicar por tema,
cruzar com histórico de publicações do Gabriel, e selecionar quais temas
valem leitura completa pelo recommender. Ativar quando cron pedir análise
ou quando Gabriel pedir 'analisa o que tem', 'quais temas estão quentes?',
'o que tá rolando?'."
---

# Content Advisor — Filtragem e Agrupamento

Você é responsável por analisar o que o scout catalogou e decidir quais
temas valem a pena serem lidos em profundidade. Você NÃO lê artigos
completos. Trabalha com metadados do banco (título, summary, tags, score).

## Ferramentas necessárias

- `exec`: para chamar `claw-kb` CLI

## Antes de começar (OBRIGATÓRIO)

Ler o arquivo de referência dos projetos do Gabriel:
`/root/.openclaw/workspace/skills/content-advisor/references/projetos-gabriel.md`

## Fluxo

### 1. Buscar artigos catalogados recentes

```
exec: claw-kb article list --status cataloged --since 7d --min-relevance 7 --limit 30
```

Se não houver artigos catalogados, responder "Sem novidades relevantes no período" e encerrar.

### 2. Buscar histórico de publicações

```
exec: claw-kb pub list --since 30d
exec: claw-kb pub topics
```

### 3. Identificar gaps

```
exec: claw-kb gaps --days 30
```

### 4. Agrupar artigos por tema

Baseado nos tags e categorias, agrupar artigos que cobrem o mesmo assunto.
Exemplos de agrupamento:
- 3 artigos sobre "agent architectures" de fontes diferentes = 1 tema
- 1 artigo sobre "fine-tuning Qwen" = 1 tema isolado
- 2 artigos sobre "novo modelo da Anthropic" = 1 tema

### 5. Para cada tema, avaliar

a) **Deduplicação**: se múltiplos artigos cobrem o mesmo fato, manter o de maior score
b) **Cruzamento**: o Gabriel já publicou sobre esse tema?
   ```
   exec: claw-kb crossref --article-id <id-do-artigo-principal>
   ```
c) **Potencial de conteúdo**: avaliar com base nos projetos do Gabriel:
   - Ele tem experiência real pra opinar? (não apenas repostar)
   - É ângulo novo ou repetição do que já postou?
   - Tem momentum? (múltiplos artigos = tema quente)
   - Tem dados concretos que sustentam um post?

### 6. Selecionar temas e marcar artigos

Para cada tema selecionado, marcar os artigos como "analyzed":
```
exec: claw-kb article update --id <N> --status analyzed
```

Selecionar no máximo 3 temas por dia.

### 7. Encerrar

Não envia nada no Telegram. Os dados ficam prontos pro recommender.

## Regras

1. NUNCA ler artigos completos. Trabalhar só com metadados do banco.
2. Máximo 3 temas por dia. Foco > volume.
3. Priorizar temas onde Gabriel pode agregar opinião original, não repost.
4. Se um tema já foi publicado recentemente (últimos 14 dias), só selecionar se houver ângulo novo.
5. Temas com apenas 1 artigo e score 7 são fracos. Preferir temas com múltiplos artigos ou score 8+.
```

### 3.4 Skill `content-recommender`

```markdown
---
name: content-recommender
description: "Ler artigos completos dos temas selecionados pelo advisor,
gerar briefings de conteúdo com ângulo original, gancho, quotes e dados
prontos pra usar, e gerar texto otimizado pro NotebookLM. Ativar quando
cron pedir recomendações ou quando Gabriel pedir 'gera recomendações',
'o que posso postar?', 'recomendações', 'briefing'."
---

# Content Recommender — Leitura e Briefing

Você é responsável por ler artigos completos, extrair valor, e gerar
briefings acionáveis. Esta é a ÚNICA skill do pipeline que lê artigos
completos via web_fetch.

## Ferramentas necessárias

- `exec`: para chamar `claw-kb` CLI
- `web_fetch`: para ler artigos completos

## Antes de começar (OBRIGATÓRIO)

Ler os arquivos de referência:
- `/root/.openclaw/workspace/skills/content-recommender/references/projetos-gabriel.md`
- `/root/.openclaw/workspace/skills/content-recommender/references/format-templates.md`
- `/root/.openclaw/workspace/skills/content-recommender/references/notebooklm-template.md`

## Fluxo

### 1. Buscar artigos prontos

```
exec: claw-kb article list --status analyzed --limit 10
```

Se não houver artigos analyzed, responder "Sem temas selecionados pelo advisor" e encerrar.

### 2. Para cada tema (artigos agrupados)

a) Ler artigos completos:
   - `web_fetch` em cada URL dos artigos do tema (2-5 artigos)
   - Se web_fetch falhar, trabalhar com o summary do scout

b) Extrair de cada artigo:
   - Dados concretos (números, métricas, benchmarks)
   - Quotes impactantes (frases prontas pra usar)
   - Argumentos e insights principais
   - Ferramentas/repos mencionados

c) Atualizar artigo no banco:
   ```
   exec: claw-kb article update --id <N> --status recommended --full-summary "<resumo completo>" --key-points '<json>'
   ```
   Se detectou ferramenta:
   ```
   exec: claw-kb article update --id <N> --has-tool 1 --tool-name "<nome>" --tool-repo "<url>"
   ```

### 3. Gerar recomendação por tema

Para cada tema, criar recomendação com:

- **Título sugerido**: conciso, provocativo, não clickbait
- **Formato**: o mais adequado pro conteúdo (linkedin-post, twitter-thread, article, newsletter, video-short)
- **Gancho**: 1-2 frases de abertura que prendem atenção. Deve partir da experiência do Gabriel, não do artigo.
- **Ângulo diferencial**: o que torna essa recomendação original. Não é repost — é a visão do Gabriel sobre o tema.
- **Pontos-chave**: 3-5 pontos a cobrir, cada um conectando o conteúdo dos artigos com a experiência do Gabriel
- **Quotes/dados**: trechos exatos dos artigos, prontos pra citar com fonte e data
- **Referência cruzada**: como isso se conecta com publicações anteriores do Gabriel
- **Prioridade**: high (timing urgente + ângulo forte), medium (bom mas não urgente), low (interessante mas pode esperar)

Salvar:
```
exec: claw-kb rec add --title "<t>" --theme "<th>" --format "<f>" --hook "<h>" --angle "<a>" --key-points '<json>' --quotes '<json>' --article-ids '<json>' --priority <p> [--related-projects '<json>'] [--cross-ref "<texto>"]
```

### 4. Gerar texto NotebookLM

Após gerar as recomendações, compilar os destaques do dia em um texto otimizado
pro formato conversacional do NotebookLM.

Ler template:
`/root/.openclaw/workspace/skills/content-recommender/references/notebooklm-template.md`

Regras do texto NotebookLM:
- Máximo 3 temas
- Linguagem conversacional, não acadêmica
- Sempre contextualizar pro Gabriel (projetos, stack, experiência)
- Incluir dados concretos e quotes
- Terminar com pergunta provocativa
- Se não houver destaques relevantes, NÃO gerar

### 5. Enviar no Telegram

**Mensagem 1 — Recomendações:**
```
Recomendações — DD/MM

1. [Formato] "Título"
   Ângulo: ...
   Baseado em: N artigos (fontes)
   Prioridade: ALTA/MÉDIA/BAIXA

2. [Formato] "Título"
   ...

Responde com o número pra ver o briefing completo.
```

**Mensagem 2 — Texto NotebookLM:**
```
Podcast do dia — DD/MM
Cola no NotebookLM:

---
[texto completo otimizado]
---
```

Se Gabriel pedir briefing expandido (responde com número), retornar:

```
Briefing #N: "Título"

Formato: ... (X palavras)
Tom: Direto, opinativo, experiência pessoal

Gancho sugerido:
"..."

Pontos a cobrir:
1. ...
2. ...
3. ...

Quotes/Dados prontos pra usar:
- "..." — Fonte, DD/MM
- "..." — Fonte, DD/MM

Referência cruzada:
- ...

CTA sugerido: ...
```

## Regras

1. SEMPRE ler os artigos completos com web_fetch antes de gerar recomendação.
2. NUNCA inventar dados ou quotes. Tudo deve vir dos artigos lidos.
3. O gancho deve partir da EXPERIÊNCIA DO GABRIEL, não do artigo.
4. Ângulo é o diferencial — se não tem ângulo original, não recomende.
5. Máximo 3 recomendações por dia. Qualidade > quantidade.
6. Idioma: tudo PT-BR, mesmo que artigos sejam em inglês.
7. Sem tabelas markdown no Telegram (usar listas).
```

### 3.5 Arquivo de referência: `notebooklm-template.md`

```markdown
# Template NotebookLM

Gere o texto seguindo esta estrutura. O NotebookLM vai transformar em diálogo
de podcast, então escreva de forma que flua como conversa.

## Estrutura

```
BRIEFING DIÁRIO DE AI — [data por extenso]

CONTEXTO: Este briefing é para Gabriel Bastos, Head de AI que trabalha com
agentes autônomos (11 agentes Qwen em produção), automação com OpenClaw,
e produz conteúdo sobre AI para LinkedIn e newsletters.

DESTAQUES DO DIA:

1. [TÍTULO DO TEMA]
[Contexto: o que aconteceu, quem publicou, por que importa]
[Relevância pro Gabriel: como se conecta com seus projetos/experiência]
[Dados importantes: métricas, quotes, fatos concretos]
[Pergunta provocativa: algo pra Gabriel refletir durante o treino]

2. [TÍTULO DO TEMA]
...

3. [TÍTULO DO TEMA SE HOUVER]
...

CONEXÕES ENTRE OS TEMAS:
[Como os destaques se relacionam entre si e com os projetos do Gabriel]

PERGUNTA DO DIA:
[Uma pergunta que conecta tudo e incentiva reflexão]
```

## Regras

- Máximo 3 temas
- Linguagem conversacional (o NotebookLM vai transformar em diálogo)
- Sempre referenciar projetos e experiência do Gabriel
- Dados concretos > opinião vaga
- Pergunta do dia deve ser genuinamente interessante, não retórica
- Se só tem 1 tema relevante, gerar com 1 tema. Não inventar pra completar 3.
- Se NENHUM tema é relevante, NÃO gerar texto. Dizer ao Gabriel que não há destaques.
```

### 3.6 Arquivo de referência: `format-templates.md`

```markdown
# Templates de Formato

Referência para o recommender escolher o formato adequado e calibrar o briefing.

## LinkedIn Post
- Tamanho: 800-1200 palavras
- Tom: Direto, opinativo, com experiência pessoal
- Estrutura: Gancho forte (1-2 frases) → Contexto breve → Insight principal → Evidência → CTA
- Funciona bem para: opinião sobre tendência, experiência prática, lição aprendida
- CTA: pergunta aberta, convite a comentar

## Twitter/X Thread
- Tamanho: 5-10 tweets (cada um ~280 chars)
- Tom: Conciso, cada tweet deve funcionar sozinho
- Estrutura: Hook → Pontos numerados → Conclusão → CTA
- Funciona bem para: listas, comparativos, takes rápidos, breaking news
- CTA: "O que vocês acham?", "Reply com sua experiência"

## Artigo / Newsletter
- Tamanho: 1500-3000 palavras
- Tom: Mais analítico, com profundidade técnica
- Estrutura: Intro → Problema → Análise → Solução/Insight → Conclusão
- Funciona bem para: análise profunda, tutorial avançado, comparativo detalhado
- CTA: link pra recurso, convite pra newsletter

## Vídeo Curto (Reels/Shorts)
- Tamanho: roteiro de 60-90 segundos
- Tom: Energético, direto ao ponto
- Estrutura: Hook em 3 segundos → 1 insight → Prova/dado → CTA
- Funciona bem para: dado surpreendente, demo rápida, take polêmico
```

### 3.7 Arquivo de referência: `projetos-gabriel.md`

```markdown
# Projetos do Gabriel

Referência para scoring, cruzamento e recomendações.

## 1. Agentes Qwen
- 11 agentes autônomos em produção
- Fine-tuning e otimização de prompts
- Orquestração multi-agent
- Stack: Qwen models, custom workflows
- Temas relacionados: agent architectures, tool-calling, multi-step reasoning, benchmarks

## 2. Conciliação Bancária
- Automação de matching de transações
- Integração com sistemas bancários
- Agentes aplicados a fintech/banking
- Temas relacionados: automação financeira, AI em fintech, data matching

## 3. Construa Sua Carreira
- Programa educacional sobre carreira em AI
- Conteúdo para profissionais migrando pra AI
- Temas relacionados: carreira em tech, educação AI, mercado de trabalho

## 4. Marca Pessoal / Posicionamento
- Autoridade em AI agents e automação
- Conteúdo para LinkedIn, newsletter, palestras
- Diferencial: experiência prática vs teoria
- Temas relacionados: personal branding, thought leadership, content strategy

## 5. OpenClaw / Automação
- Antonio Bot (Bicho Antonio)
- Pipeline de conteúdo automatizado
- Skills e cron jobs
- Temas relacionados: AI assistants, automation, productivity tools
```

---

## 4. Componente 3: Cron Jobs

| # | Job | Schedule (UTC) | Schedule (BRT) | Prompt |
|---|-----|---------------|----------------|--------|
| 1 | Scout P0 | `0 10 * * *` | Diário 7h | "Ler skill content-scout. Verificar fontes P0. Aplicar scoring, catalogar. Notificar se score >= 8." |
| 2 | Scout P1 | `30 10 * * 1,3,5` | Seg/Qua/Sex 7h30 | "Ler skill content-scout. Verificar fontes P1. Aplicar scoring, catalogar. Notificar se score >= 8." |
| 3 | Scout P2 | `0 11 * * 0` | Domingo 8h | "Ler skill content-scout. Verificar fontes P2. Aplicar scoring, catalogar. Notificar se score >= 8." |
| 4 | Advisor | `0 12 * * *` | Diário 9h | "Ler skill content-advisor. Buscar artigos catalogados últimos 7 dias. Deduplicar, cruzar com publicações, agrupar temas, marcar como analyzed." |
| 5 | Recommender | `0 13 * * *` | Diário 10h | "Ler skill content-recommender. Buscar artigos analyzed. Ler completos, gerar briefings e texto NotebookLM. Enviar no Telegram." |
| 6 | Digest | `0 11 * * 1` | Segunda 8h | "Gerar digest semanal: claw-kb stats + top artigos + recs pendentes + gaps. Enviar no Telegram." |

---

## 5. Fases de Implementação

### Fase 1 — claw-kb CLI
1. Criar estrutura do projeto TypeScript
2. Implementar `db.ts` (schema + migrations)
3. Implementar `types.ts` e `validators.ts`
4. Implementar comandos: source, article, rec, pub
5. Implementar comandos: analysis (crossref, gaps, digest), maintenance
6. Criar `seed.ts` com as 18 fontes
7. Criar `test.ts` e validar todos os comandos
8. Deploy na VPS + criar symlink `claw-kb`

### Fase 2 — Skills
1. Criar content-scout + references
2. Criar content-advisor + references
3. Criar content-recommender + references
4. Testar manualmente: scout 2-3 fontes → verificar banco → advisor → recommender → verificar output Telegram

### Fase 3 — Automação
1. Configurar 6 cron jobs
2. Testar ciclo completo end-to-end
3. Ajustar thresholds e frequências
