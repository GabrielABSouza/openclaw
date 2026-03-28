# Arquitetura: Content Intelligence Pipeline

> Versão: 3.1 — 2026-03-28
> Status: DRAFT — aguardando validação

---

## 1. Visão Geral

Pipeline de inteligencia de conteudo usando OpenClaw.

**O que faz:**
1. **Consome** conteúdo de blogs e newsletters de AI/tech via RSS e web scraping
2. **Cataloga** de forma estruturada em SQLite via CLI determinística (título, URL, tags, resumo curto do feed)
3. **Filtra e deduplica** conteúdo relevante, cruzando com histórico de publicações do usuario
4. **Lê artigos completos** dos temas filtrados e gera briefings de conteúdo acionáveis
5. **Entrega** recomendações prontas no Telegram
6. **Gera texto otimizado pro NotebookLM** pra o usuario ouvir como podcast durante o treino

**O que NÃO faz (por enquanto):**
- Não gera o texto final (o usuario usa Claude Opus direto)
- Não publica automaticamente
- Não consome Twitter/X nem Reddit (fase futura)
- Não transcreve vídeos (só título + descrição)

**Modelo:** Gemini 2.5 Flash Lite (custo ~$0)
**Idioma:** Tudo em PT-BR

---

## 2. Arquitetura

```
┌────────────────────────────────────────────────────────────────────────┐
│                            VPS                                            │
│                                                                        │
│  ┌──────────┐    ┌────────────────┐    ┌────────────────────┐         │
│  │  Cron     │───►│  OpenClaw       │───►│  claw-kb CLI       │         │
│  │  Jobs     │    │  (Gemini)      │    │  (Node.js)         │         │
│  └──────────┘    └──────┬─────────┘    └────────┬───────────┘         │
│                         │                        │                     │
│                         │ exec                   │ SQLite              │
│                         ▼                        ▼                     │
│                                                                        │
│   PIPELINE AUTOMÁTICO (3 etapas sequenciais via cron)                  │
│                                                                        │
│   ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│   │  1. SCOUT        │  │  2. ADVISOR      │  │  3. RECOMMENDER      │  │
│   │                  │  │                  │  │                      │  │
│   │  Ingere feeds    │  │  Deduplica       │  │  Lê artigos 8+      │  │
│   │  Aplica scoring  │──►│  Cruza com banco │──►│  Gera briefings     │  │
│   │  Cataloga        │  │  Agrupa temas    │  │  Salva recomendações │  │
│   │  (título+excerpt)│  │  Filtra temas    │  │  Envia no Telegram   │  │
│   └─────────────────┘  └─────────────────┘  └──────────────────────┘  │
│                                                                        │
│   SKILLS SOB DEMANDA (o usuario pede manualmente)                        │
│                                                                        │
│   ┌─────────────────┐  ┌─────────────────┐                            │
│   │  summarizer      │  │  feedback-loop   │                            │
│   │  (resume links)  │  │  (ajusta tom)    │                            │
│   └─────────────────┘  └─────────────────┘                            │
│                                                        ┌─────────┐    │
│               content.db ◄────────────────────────────►│ claw-kb │    │
│               (sources, articles, recs, pubs)          └─────────┘    │
│                                                                        │
│                         │                                              │
│                         ▼                                              │
│                  ┌──────────────┐                                      │
│                  │  Telegram    │                                      │
│                  │  (o usuario)   │                                      │
│                  └──────┬──────┘                                      │
│                         │                                              │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │  o usuario     │
                  │  curadoria + │
                  │  Claude Opus │
                  │  (escrita)   │
                  └──────────────┘
```

### Princípio: o LLM nunca toca no banco

O agente chama `claw-kb <comando>` via exec. A CLI:
- Valida todos os inputs antes de gravar
- Garante schema consistency
- Retorna JSON estruturado
- Previne SQL injection, schema drift, dados corrompidos
- É testável independente do LLM

---

## 3. Componente: `claw-kb` CLI

### 3.1 Stack
- **Runtime:** Node.js (já na VPS)
- **Database:** better-sqlite3 (sync, zero overhead)
- **Local:** `~/.openclaw/tools/claw-kb/`
- **DB path:** `~/.openclaw/tools/claw-kb/content.db`
- **Chamada:** `claw-kb <comando> [flags]`

### 3.2 Schema

```sql
CREATE TABLE sources (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL,                -- "rss", "blog", "youtube", "newsletter"
  url             TEXT,
  priority        TEXT NOT NULL DEFAULT 'P1',   -- P0, P1, P2
  frequency       TEXT NOT NULL,                -- "daily", "3x-week", "weekly"
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE articles (
  id                  INTEGER PRIMARY KEY,
  source_id           INTEGER REFERENCES sources(id),
  url                 TEXT UNIQUE,                  -- dedup key
  title               TEXT NOT NULL,
  content_type        TEXT NOT NULL,                -- "article", "video", "paper", "post", "newsletter-issue"
  category            TEXT,                          -- "ai", "tech", "negocios", "carreira", "marketing", "tools"
  tags                TEXT,                          -- JSON array
  summary             TEXT,                          -- 2-3 frases (extraídas do feed/excerpt pelo scout)
  full_summary        TEXT,                          -- Resumo completo (gerado pelo recommender após ler artigo)
  key_points          TEXT,                          -- JSON array (gerado pelo recommender)
  relevance           INTEGER DEFAULT 0,            -- 0-10, calculado pelo scoring system (seção 4.4)
  relevance_breakdown TEXT,                          -- JSON: critérios que pontuaram (auditoria)
  has_tool            INTEGER DEFAULT 0,
  tool_name           TEXT,
  tool_repo           TEXT,
  status              TEXT DEFAULT 'ingested',      -- ver seção 3.3 para ciclo de vida
  ingested_at         TEXT NOT NULL DEFAULT (datetime('now')),
  published_at        TEXT                           -- data original do conteúdo
);

CREATE TABLE recommendations (
  id               INTEGER PRIMARY KEY,
  article_ids      TEXT NOT NULL,                -- JSON array de IDs
  theme            TEXT NOT NULL,                -- Tema agrupado pelo advisor
  title            TEXT NOT NULL,                -- Título sugerido pelo recommender
  format           TEXT NOT NULL,                -- "linkedin-post", "twitter-thread", "article", "newsletter", "video-short"
  hook             TEXT NOT NULL,                -- Gancho/abertura
  angle            TEXT NOT NULL,                -- Ângulo original (diferencial)
  key_points       TEXT NOT NULL,                -- JSON array de pontos a cobrir
  quotes           TEXT,                          -- JSON array de quotes/dados prontos pra usar
  target_audience  TEXT,
  related_projects TEXT,                          -- JSON array: ["agentes-qwen", "marca-pessoal"]
  cross_ref        TEXT,                          -- Referência cruzada com publicações anteriores
  priority         TEXT DEFAULT 'medium',        -- "high", "medium", "low"
  status           TEXT DEFAULT 'pending',       -- "pending" → "approved" → "published" | "rejected"
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE publications (
  id                INTEGER PRIMARY KEY,
  platform          TEXT NOT NULL,              -- "linkedin", "twitter", "newsletter", "blog", "youtube"
  title             TEXT NOT NULL,
  url               TEXT,
  topics            TEXT,                        -- JSON array
  published_at      TEXT NOT NULL,
  recommendation_id INTEGER REFERENCES recommendations(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices para queries frequentes
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_ingested ON articles(ingested_at);
CREATE INDEX idx_articles_url ON articles(url);
CREATE INDEX idx_articles_relevance ON articles(relevance);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_publications_published ON publications(published_at);
```

### 3.3 Ciclo de vida dos artigos

```
                    Scout                    Advisor              Recommender
                      │                        │                       │
  score 0-4:  ──► "skipped"                    │                       │
                      │                        │                       │
  score 5-6:  ──► "ingested"  ──────────► disponível pra              │
                      │                   cruzamento                   │
                      │                        │                       │
  score 7+:   ──► "cataloged" ──────────► disponível pra              │
                      │                   cruzamento                   │
                      │                        │                       │
  score 8+:   ──► "cataloged" ──► selecionado ──► "analyzed" ──► artigo lido,
                  + notifica       pelo advisor     pelo recommender   recomendação gerada
                  no Telegram                              │
                                                           ▼
                                                     "recommended"
                                                           │
                                              o usuario aprova/rejeita
                                                     │          │
                                                     ▼          ▼
                                               "published"  "rejected"
```

### 3.4 Comandos

Todos retornam JSON: `{ "ok": true/false, "command": "...", "count": N, "data": [...] }`

```
FONTES
  claw-kb source add --name <name> --type <type> --url <url> --priority <P0|P1|P2> --frequency <freq>
  claw-kb source list [--priority P0] [--enabled]
  claw-kb source check --name <name>              # atualiza last_checked_at
  claw-kb source disable --name <name>
  claw-kb source enable --name <name>

ARTIGOS
  claw-kb article add --url <url> --title <title> --source <source-name> --category <cat> --tags '<json>' --content-type <type>
  claw-kb article exists --url <url>               # retorna { "ok": true, "exists": true/false, "id": N }
  claw-kb article update --id <N> [--status <s>] [--summary <text>] [--full-summary <text>] [--key-points '<json>'] [--relevance <0-10>] [--relevance-breakdown '<json>'] [--has-tool 1] [--tool-name <n>] [--tool-repo <url>]
  claw-kb article list [--status <s>] [--category <c>] [--since <date>] [--min-relevance <N>] [--limit <N>]
  claw-kb article search --query <text>            # FTS em title + summary
  claw-kb article stats                            # contadores por status, categoria, fonte
  claw-kb article get --id <N>                     # detalhe completo de um artigo

RECOMENDAÇÕES
  claw-kb rec add --title <t> --theme <th> --format <f> --hook <h> --angle <a> --key-points '<json>' --quotes '<json>' --article-ids '<json>' [--priority high] [--related-projects '<json>'] [--cross-ref <text>]
  claw-kb rec list [--status pending] [--priority high] [--since <date>]
  claw-kb rec update --id <N> --status <approved|published|rejected>
  claw-kb rec detail --id <N>                      # recomendação + artigos-fonte expandidos

PUBLICAÇÕES
  claw-kb pub add --platform <p> --title <t> --topics '<json>' --published-at <date> [--url <url>] [--recommendation-id <N>]
  claw-kb pub list [--platform <p>] [--since <date>]
  claw-kb pub topics                               # todos os tópicos com contagem

ANÁLISE
  claw-kb crossref --article-id <N>                # publicações do usuario sobre temas similares ao artigo
  claw-kb gaps [--days 30]                         # categorias/tópicos com artigos ingeridos mas sem publicação recente
  claw-kb digest [--since yesterday] [--priority P0]  # resumo do período

MANUTENÇÃO
  claw-kb stats                                    # dashboard: fontes, artigos, recs, pubs
  claw-kb prune --older-than 90d --status skipped  # limpa artigos antigos descartados
  claw-kb export --format json > backup.json
  claw-kb import --file backup.json
```

### 3.5 Validações da CLI

A CLI rejeita com erro claro (não grava silenciosamente):
- `article add` com URL duplicada → `{ "ok": false, "code": "DUPLICATE_URL" }`
- `article update --relevance 15` → `{ "ok": false, "code": "INVALID_RELEVANCE", "error": "Must be 0-10" }`
- `rec add` sem `--article-ids` → `{ "ok": false, "code": "MISSING_REQUIRED" }`
- `source add` com priority inválida → `{ "ok": false, "code": "INVALID_PRIORITY" }`
- JSON malformado em arrays → `{ "ok": false, "code": "INVALID_JSON" }`

---

## 4. Fontes de Conteúdo

### Escopo inicial: blogs + newsletters (RSS/web scraping)

Twitter/X, Reddit, e transcrição de YouTube ficam pra fase futura.

### 4.1 P0 — Diário (cron 7h BRT / 10:00 UTC)

| Fonte | Tipo | URL | Método |
|-------|------|-----|--------|
| TLDR AI | newsletter | tldr.tech/ai | web_fetch RSS/site |
| The Neuron | newsletter | theneurondaily.com | web_fetch RSS/site |
| Ben's Bites | newsletter | bensbites.com | web_fetch RSS/site |

**Por que P0:** Newsletters diárias já são curadoria filtrada. Volume previsível, formato consistente, alto valor por item.

### 4.2 P1 — Seg/Qua/Sex (cron 8h BRT / 11:00 UTC)

| Fonte | Tipo | URL | Método |
|-------|------|-----|--------|
| Anthropic Blog | blog | anthropic.com/blog | web_fetch RSS |
| OpenAI Blog | blog | openai.com/blog | web_fetch RSS |
| Google DeepMind Blog | blog | deepmind.google/blog | web_fetch RSS |
| Hugging Face Blog | blog | huggingface.co/blog | web_fetch RSS |
| LangChain Blog | blog | blog.langchain.dev | web_fetch RSS |
| LlamaIndex Blog | blog | llamaindex.ai/blog | web_fetch RSS |
| Simon Willison | blog | simonwillison.net | web_fetch RSS |
| Ahead of AI (Raschka) | newsletter | magazine.sebastianraschka.com | web_fetch RSS |
| Papers With Code | blog | paperswithcode.com | web_fetch trending |

**Por que P1:** Blogs técnicos publicam 1-5x/semana. Conteúdo profundo. Checar 3x/semana garante que nada escapa.

### 4.3 P2 — Semanal (cron domingo 9h BRT / 12:00 UTC)

| Fonte | Tipo | URL | Método |
|-------|------|-----|--------|
| a16z AI Blog | blog | a16z.com/ai | web_fetch RSS |
| The Batch (Andrew Ng) | newsletter | deeplearning.ai/the-batch | web_fetch RSS |
| AI Explained (YT) | youtube | youtube.com/@aiexplained-official | web_fetch (título + descrição) |
| Matthew Berman (YT) | youtube | youtube.com/@MatthewBerman | web_fetch (título + descrição) |
| Fireship (YT) | youtube | youtube.com/@Fireship | web_fetch (título + descrição) |
| Hacker News | agregador | news.ycombinator.com | web_fetch (top AI/ML) |

**Por que P2:** Conteúdo de mercado/visão macro e vídeos longos. Valor mais estratégico que tático. Basta 1x/semana.

**YouTube:** Apenas título + descrição. Sem transcrição (custo alto de tokens). Se o usuario quiser transcrição, pede manualmente.

### 4.4 Scoring System de Relevância

O agente **não chuta** um número de 0-10. Ele aplica critérios objetivos e soma pontos. O score final determina a ação.

#### Critérios positivos (somam)

| Critério | Pontos | Exemplo |
|----------|--------|---------|
| **Projeto direto**: menciona tema central de um dos projetos do usuario (agentes AI, conciliação bancária, construa sua carreira, marca pessoal/posicionamento) | +3 | Artigo sobre arquitetura de multi-agent systems → +3 (agentes) |
| **Ferramenta integrável**: repo, CLI, API, framework que pode ser integrado à stack do usuario (OpenClaw, agentes Qwen, workflow de automação) | +2 | Novo framework de orquestração de agentes com repo GitHub → +2 |
| **Provider relevante**: breaking news ou atualização de provider que o usuario usa ativamente (Anthropic/Claude, Google/Gemini, Alibaba/Qwen) | +2 | "Anthropic lança tool-use nativo no Claude" → +2 |
| **Tema publicável**: assunto que cruza com temas onde o usuario já publicou ou pode publicar com opinião original | +2 | Debate sobre AI agents em produção → +2 (o usuario tem experiência real) |
| **Dados concretos**: contém benchmarks, métricas, case studies, comparativos quantitativos (não especulação) | +1 | "Qwen3-72B scored 92.3% on HumanEval" → +1 |
| **Opinião qualificada**: análise ou take de alguém reconhecido (não é só notícia factual repostada) | +1 | Simon Willison analisando trade-offs de agent frameworks → +1 |
| **Tendência emergente**: tema que apareceu em 2+ fontes nos últimos 7 dias (sinal de momentum) | +1 | "Agent architectures" apareceu em Anthropic blog + HF blog + Raschka essa semana → +1 |

#### Critérios negativos (subtraem)

| Critério | Pontos | Exemplo |
|----------|--------|---------|
| **Conteúdo introdutório/tutorial básico**: explica conceitos que o usuario já domina (o que é RAG, como funciona um LLM, intro a prompt engineering) | -2 | "O que são AI agents? Um guia para iniciantes" → -2 |
| **Notícia requentada**: mesmo fato já coberto por outra fonte ingerida, sem análise ou ângulo novo | -3 | Terceiro artigo sobre o mesmo lançamento, sem opinião adicional → -3 |
| **Hype sem substância**: artigo que usa buzzwords mas não traz informação acionável, dados, ou insight técnico | -2 | "AI vai revolucionar tudo em 2026! 10 previsões!" → -2 |
| **Fora de escopo**: não tem relação com AI, tech, negócios, carreira, ou marketing | -5 | Artigo sobre culinária, esportes, entretenimento genérico → -5 |

#### Cálculo

```
score = soma(critérios positivos) + soma(critérios negativos)
score = max(0, min(10, score))    -- clamp entre 0 e 10
```

#### Thresholds de ação

| Score | Ação | Skill responsável |
|-------|------|-------------------|
| 0-4 | `status: "skipped"` — salva só título/URL no banco | Scout |
| 5-6 | `status: "ingested"` — salva metadados, disponível pro advisor cruzar | Scout |
| 7+ | `status: "cataloged"` — salva metadados + resumo curto do feed/excerpt | Scout |
| 8+ | Além de catalogar, entra na fila do advisor pra análise de temas | Scout → Advisor |

#### Auditoria

O agente salva o breakdown do score junto com o artigo:
```json
{
  "relevance": 8,
  "breakdown": {
    "projeto_direto": { "matched": "agentes-qwen", "points": 3 },
    "ferramenta_integravel": { "matched": null, "points": 0 },
    "provider_relevante": { "matched": "anthropic", "points": 2 },
    "tema_publicavel": { "matched": true, "points": 2 },
    "dados_concretos": { "matched": true, "points": 1 },
    "opiniao_qualificada": { "matched": false, "points": 0 },
    "tendencia_emergente": { "matched": false, "points": 0 },
    "conteudo_introdutorio": { "matched": false, "points": 0 },
    "noticia_requentada": { "matched": false, "points": 0 },
    "hype_sem_substancia": { "matched": false, "points": 0 },
    "fora_de_escopo": { "matched": false, "points": 0 }
  }
}
```

Isso permite auditar: se o usuario discordar de um score, a gente vê qual critério pesou errado e ajusta.

### 4.5 Fluxo de consumo (executado pelo Scout)

```
Para cada fonte habilitada na prioridade do dia:
  1. web_fetch no URL da fonte
  2. Extrair lista de itens (artigos/posts/vídeos)
  3. Para cada item:
     a. claw-kb article exists --url <url>
     b. SE já existe → skip
     c. SE novo:
        - Extrair título, URL, data de publicação, excerpt
        - claw-kb article add (status: "ingested")
        - Aplicar scoring system (seção 4.4) com base em título + excerpt
        - SE score 0-4:
            - claw-kb article update --status skipped --relevance <N> --relevance-breakdown '<json>'
        - SE score 5-6:
            - claw-kb article update --status ingested --relevance <N> --relevance-breakdown '<json>'
        - SE score 7+:
            - claw-kb article update --status cataloged --relevance <N> --relevance-breakdown '<json>' --summary "..." --tags '[...]'
  4. claw-kb source check --name <fonte> (atualiza timestamp)
```

### 4.6 Limitações e fallbacks

| Problema | Fallback |
|----------|----------|
| Site com paywall | Marcar fonte como "failed" no log, tentar browser tool, notificar o usuario |
| RSS indisponível | Fallback pra web scraping da página de listagem do blog |
| Fonte fora do ar | Skip, tentar no próximo ciclo, alertar após 3 falhas consecutivas |
| Conteúdo duplicado (mesmo artigo em múltiplas fontes) | Dedup por URL. Se URLs diferentes pro mesmo conteúdo, o advisor deduplica por tema |

---

## 5. Skills

### 5.1 `content-scout` (NOVA) — Etapa 1: Ingestão

**Responsabilidade:** Ingerir conteúdo das fontes, aplicar scoring, catalogar no banco. **Não lê artigos completos.**

**Trigger:**
- Cron jobs (automático, por prioridade)
- Manual: "verifica as fontes", "o que tem de novo", "roda o scout"

**Dependências:** claw-kb CLI, web_fetch tool

**Fluxo:** Ver seção 4.5

**Output Telegram (só quando tem score 8+):**
```
Scout — 28/03

Ingeri 15 itens de 6 fontes.

Score 8+:
- [Anthropic Blog] "Claude's New Agent Architecture" — agents, reasoning (score: 9)
- [HF Blog] "SmolAgents v2: Tool-calling without frameworks" — agents, tools (score: 8)

Total: 15 novos | 4 catalogados | 2 score 8+ | 9 descartados

Advisor roda às 10h com esses dados.
```

### 5.2 `content-advisor` (NOVA) — Etapa 2: Filtragem e agrupamento

**Responsabilidade:** Deduplica artigos, cruza com banco de publicações, agrupa por tema, e seleciona quais temas valem leitura completa pelo recommender. **Não lê artigos completos. Não gera briefings.**

**Trigger:**
- Cron diário (automático, após scout)
- Manual: "analisa o que tem no banco", "quais temas estão quentes?"

**Dependências:** claw-kb CLI

**Fluxo:**
```
1. Buscar artigos recentes catalogados:
   claw-kb article list --status cataloged --since 7d --min-relevance 7 --limit 30

2. Buscar publicações recentes do usuario:
   claw-kb pub list --since 30d
   claw-kb pub topics

3. Identificar gaps:
   claw-kb gaps --days 30

4. Agrupar artigos por tema/cluster (baseado em tags e categorias)

5. Para cada cluster:
   a. Deduplicar: se múltiplos artigos cobrem o mesmo fato, manter o melhor (maior score)
   b. claw-kb crossref (buscar publicações anteriores do usuario sobre o tema)
   c. Avaliar se o tema tem potencial de conteúdo original:
      - o usuario tem experiência/opinião pra agregar?
      - É ângulo novo ou já postou algo parecido recentemente?
      - Tem momentum (múltiplos artigos sobre o tema)?

6. Selecionar top temas e marcar artigos como "analyzed":
   claw-kb article update --id <N> --status analyzed

7. Passar a lista de temas + artigos pro recommender (próxima etapa do cron)
```

**Não envia nada no Telegram.** Apenas prepara os dados pro recommender.

### 5.3 `content-recommender` (NOVA) — Etapa 3: Leitura e recomendação

**Responsabilidade:** Lê artigos completos dos temas selecionados pelo advisor. Gera briefings de conteúdo ricos com ângulo, gancho, quotes e dados. **Esta é a única skill que lê artigos completos.**

**Trigger:**
- Cron diário (automático, após advisor)
- Manual: "gera recomendações", "o que posso postar?"

**Dependências:** claw-kb CLI, web_fetch tool

**Fluxo:**
```
1. Buscar artigos prontos pra leitura:
   claw-kb article list --status analyzed --limit 10

2. Para cada tema agrupado pelo advisor:
   a. web_fetch nos artigos completos (2-5 artigos por tema)
   b. Extrair: dados concretos, quotes, insights, argumentos principais
   c. claw-kb article update --id <N> --status recommended --full-summary "..." --key-points '[...]'

3. Gerar recomendação por tema:
   - Título sugerido
   - Formato (linkedin-post, thread X, artigo, vídeo curto, newsletter)
   - Gancho (1-2 frases de abertura)
   - Ângulo diferencial (o que torna essa rec original, não repost)
   - Pontos-chave a cobrir (extraídos dos artigos)
   - Quotes/dados prontos pra usar
   - Referência cruzada com publicações anteriores do usuario
   - Prioridade (high/medium/low)

4. Salvar:
   claw-kb rec add --title "..." --theme "..." --format "..." --hook "..." --angle "..." --key-points '[...]' --quotes '[...]' --article-ids '[...]' --priority high --cross-ref "..."

5. Gerar texto pro NotebookLM (ver seção 5.3.1)

6. Enviar no Telegram: recomendações + texto NotebookLM
```

**Output Telegram (produto final do pipeline):**
```
Recomendações — 28/03

1. [LinkedIn Post] "Por que Agent Architectures falham em produção"
   Ângulo: Comparar padrões do mercado com tua experiência real nos agentes Qwen
   Baseado em: 3 artigos (Anthropic blog, HF blog, LangChain blog)
   Prioridade: ALTA

2. [Thread X] "SmolAgents vs LangChain: quando menos é mais"
   Ângulo: Tua visão sobre frameworks leves vs pesados pra agentes
   Baseado em: 2 artigos (HF blog, Simon Willison)
   Prioridade: MÉDIA

Responde com o número pra ver o briefing completo.
```

**Briefing expandido (quando usuario escolhe um número):**
```
Briefing #1: "Por que Agent Architectures falham em produção"

Formato: LinkedIn Post (800-1200 palavras)
Tom: Direto, opinativo, experiência pessoal

Gancho sugerido:
"Desenhei 11 agentes que operam em produção.
A maioria dos patterns que a indústria recomenda não funcionou."

Pontos a cobrir:
1. O paper da Anthropic propõe X — quando apliquei nos agentes Qwen, Y aconteceu
2. O framework Z promete abstração — na prática, criou mais problemas que resolveu
3. O que realmente importa: [insight concreto dos artigos]

Quotes/Dados prontos pra usar:
- "..." — Anthropic Blog, 25/03
- "..." — HF Blog, 27/03
- "92.3% accuracy on agent benchmarks" — LangChain case study

Referência cruzada:
- Você nunca postou sobre failure modes → ângulo novo
- Tema "agentes em produção" teve 3 artigos essa semana → timing bom

CTA sugerido: Pergunta aberta sobre experiências dos seguidores com agents
```

#### 5.3.1 Output NotebookLM — Podcast diário de AI

Junto com as recomendações, o recommender gera um texto otimizado pro formato conversacional do NotebookLM. o usuario cola no NotebookLM e gera o áudio pra ouvir no treino.

**O texto é enviado como mensagem separada no Telegram**, pronto pra copiar e colar:

```
Podcast do dia — 28/03
Cola esse texto no NotebookLM pra gerar teu áudio:

---
BRIEFING DIÁRIO DE AI — 28 de março de 2026

CONTEXTO: Este briefing é para <your-name>, <your-role> que trabalha com
agentes autônomos (11 agentes Qwen em produção), automação com OpenClaw,
e produz conteúdo sobre AI para LinkedIn e newsletters.

DESTAQUES DO DIA:

1. AGENT ARCHITECTURES EM PRODUÇÃO
A Anthropic publicou um paper sobre arquiteturas de agentes multi-step.
O ponto central é [X]. Isso é relevante porque o usuario opera 11 agentes
em produção e a abordagem proposta contradiz/confirma o que ele já faz
com [Y]. Dados importantes: [quotes e métricas extraídas dos artigos].
Pergunta provocativa: a arquitetura proposta funcionaria no contexto de
conciliação bancária onde o usuario aplica agentes?

2. SMOLAGENTS V2
O Hugging Face lançou a v2 do SmolAgents com tool-calling nativo sem
framework pesado. Isso importa porque [X]. Comparado com LangChain que
o usuario já avaliou, a diferença é [Y]. Simon Willison comentou que [Z].
Pergunta provocativa: vale migrar algum dos 11 agentes pra SmolAgents
ou o overhead de migração não justifica?

3. [TEMA ADICIONAL SE HOUVER]
...

CONEXÕES ENTRE OS TEMAS:
[Como os destaques do dia se relacionam entre si e com os projetos do usuario]

PERGUNTA DO DIA:
[Uma pergunta provocativa que conecta os temas e incentiva reflexão durante o treino]
---
```

**Regras do texto NotebookLM:**
- Máximo 3 temas por dia (foco > volume)
- Linguagem conversacional, não acadêmica — o NotebookLM vai transformar em diálogo
- Sempre contextualizar pro usuario (seus projetos, sua stack, sua experiência)
- Incluir dados concretos e quotes — dá substância pro áudio
- Terminar com pergunta provocativa — mantém o usuario pensando no treino
- Se não houver destaques relevantes no dia, **não gerar** (não forçar conteúdo raso)

### 5.4 `content-summarizer` (EXISTENTE — sem mudanças)

**Não participa do pipeline automático.** Funciona exclusivamente sob demanda:
- o usuario manda link no Telegram → summarizer lê artigo completo e gera resumo estruturado
- o usuario pede "resume o artigo X do scout report" → summarizer lê e resume
- o usuario pede transcrição de YouTube → summarizer processa

Totalmente independente do pipeline scout → advisor → recommender.

### 5.5 `feedback-loop` (EXISTENTE — sem mudanças)

Continua gerenciando preferências de tom/estrutura. Sem integração com claw-kb.

---

## 6. Gestão de Publicações (manual)

O o usuario gerencia o ciclo de vida das recomendações via Telegram:

```
o usuario: "aprovei a rec 3"
→ claw-kb rec update --id 3 --status approved

o usuario: "publiquei a rec 3 no linkedin"
→ claw-kb pub add --platform linkedin --title "..." --topics '[...]' --published-at 2026-03-28 --recommendation-id 3
→ claw-kb rec update --id 3 --status published

o usuario: "descarta a rec 2"
→ claw-kb rec update --id 2 --status rejected
```

Sem bootstrap de publicações históricas. O crossref começa a funcionar conforme o usuario registra novas publicações. A qualidade do cruzamento melhora com o tempo.

---

## 7. Cron Jobs

| Job | Schedule | Horário BRT | Prompt do cron |
|-----|----------|-------------|----------------|
| Scout P0 | Diário | 7h | "Ler skill content-scout. Verificar fontes P0. Ingerir, aplicar scoring, catalogar. Notificar no Telegram se score >= 8." |
| Scout P1 | Seg/Qua/Sex | 7h30 | "Ler skill content-scout. Verificar fontes P1. Ingerir, aplicar scoring, catalogar. Notificar se score >= 8." |
| Scout P2 | Domingo | 8h | "Ler skill content-scout. Verificar fontes P2. Ingerir, aplicar scoring, catalogar. Notificar se score >= 8." |
| Advisor | Diário | 9h | "Ler skill content-advisor. Buscar artigos catalogados últimos 7 dias. Deduplicar, cruzar com publicações, agrupar por tema, marcar artigos como analyzed." |
| Recommender | Diário | 10h | "Ler skill content-recommender. Buscar artigos analyzed. Ler completos, gerar briefings, salvar recomendações. Enviar top recomendações no Telegram." |
| Digest semanal | Segunda | 8h | "Gerar digest semanal: claw-kb stats + artigos top da semana + recomendações pendentes + gaps de conteúdo. Enviar no Telegram." |

---

## 8. O que precisa ser construído

### Artefato 1: `claw-kb` CLI
- **O que:** CLI Node.js com better-sqlite3
- **Onde:** `~/.openclaw/tools/claw-kb/`
- **Arquivos:**
  - `package.json`
  - `index.js` (entry point, parser de comandos)
  - `db.js` (inicialização do schema, migrations)
  - `commands/source.js`
  - `commands/article.js`
  - `commands/rec.js`
  - `commands/pub.js`
  - `commands/analysis.js` (crossref, gaps, digest)
  - `commands/maintenance.js` (stats, prune, export, import)
- **Testes:** Script de teste que valida todos os comandos

### Artefato 2: Skill `content-scout`
- **O que:** SKILL.md com instruções de ingestão e scoring
- **Onde:** `~/.openclaw/workspace/skills/content-scout/`
- **Arquivos:**
  - `SKILL.md`
  - `references/scoring-system.md` (critérios e pesos)
  - `references/sources-config.md` (documentação das fontes)

### Artefato 3: Skill `content-advisor`
- **O que:** SKILL.md com instruções de deduplicação, cruzamento e agrupamento
- **Onde:** `~/.openclaw/workspace/skills/content-advisor/`
- **Arquivos:**
  - `SKILL.md`
  - `references/projetos-usuario.md` (compartilhado com content-summarizer)

### Artefato 4: Skill `content-recommender`
- **O que:** SKILL.md com instruções de leitura completa e geração de briefings
- **Onde:** `~/.openclaw/workspace/skills/content-recommender/`
- **Arquivos:**
  - `SKILL.md`
  - `references/projetos-usuario.md` (compartilhado)
  - `references/format-templates.md` (templates de output por formato de conteúdo)

### Artefato 5: Cron jobs
- **O que:** 6 cron jobs configurados no OpenClaw
- **Como:** `openclaw cron add`

### Artefato 6: Seed de fontes
- **O que:** Script que popula a tabela `sources` com as 18 fontes listadas na seção 4

---

## 9. Fases de Implementação

### Fase 1 — claw-kb CLI
- Criar projeto Node.js com better-sqlite3
- Implementar schema + todos os comandos
- Deploy na VPS
- Seed das fontes
- Testar todos os comandos manualmente

### Fase 2 — Skills
- Criar content-scout
- Criar content-advisor
- Criar content-recommender
- Testar manualmente: scout 2-3 fontes → verificar banco → rodar advisor → rodar recommender → verificar output

### Fase 3 — Automação
- Configurar cron jobs
- Testar ciclo completo: cron → scout → advisor → recommender → Telegram
- Ajustar thresholds e frequências com base no volume real

### Fase futura (não agora)
- Twitter/X via browser scraping
- Reddit (r/LocalLLaMA, HN) via scraping
- YouTube transcrição sob demanda
- Integração com Claude Opus pra geração de texto final
- Auto-posting em LinkedIn/X

---

## 10. Custos

| Componente | Custo |
|------------|-------|
| Gemini 2.5 Flash Lite (scout + advisor) | ~$0 (free tier, trabalha só com títulos/excerpts) |
| Gemini 2.5 Flash Lite (recommender) | ~$0 (free tier, lê 2-5 artigos/dia completos) |
| better-sqlite3 | $0 |
| VPS (já rodando) | $0 incremental |
| **Total** | **~$0** |

---

## 11. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| web_fetch falha em site com paywall | Média | Marcar como "failed", tentar browser tool, notificar o usuario |
| Gemini classifica scoring errado | Média | Breakdown de auditoria permite identificar critério errado. o usuario ajusta pesos |
| RSS de fonte muda/quebra | Baixa | Fallback pra scraping da página. Alertar após 3 falhas consecutivas |
| Recommender gera briefing raso | Média | Templates de formato detalhados. o usuario dá feedback via feedback-loop |
| Volume de notificações alto demais | Baixa | Subir threshold. Agrupar em digest |
| SQLite cresce demais | Muito baixa | Prune automático de "skipped" > 90 dias. Estimativa: ~5MB/ano |
| Gemini Flash Lite não segue instruções das skills | Média | Skills com instruções simples e diretas. Pipeline em 3 etapas reduz complexidade por skill |
| Advisor não consegue deduplicar bem | Baixa | Dedup por URL é determinístico (claw-kb). Dedup por tema é best-effort do LLM |
