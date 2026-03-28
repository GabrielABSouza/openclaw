# OpenClaw Content Intelligence

Pipeline de inteligencia de conteudo usando [OpenClaw](https://openclaw.ai) — curadoria automatizada de fontes, resumos estruturados e recomendacoes de conteudo entregues via Telegram.

## O que faz

```
18 fontes (RSS/blogs/newsletters)
        |
   [Scout] — ingere e aplica scoring de relevancia (0-10)
        |
   [Advisor] — deduplica, cruza com historico, filtra por tema
        |
   [Recommender] — le artigos completos, gera briefings com angulo original
        |
   Telegram — usuario recebe recomendacoes prontas para produzir conteudo
```

O usuario tambem pode enviar links avulsos no Telegram e receber resumos estruturados (skill `content-summarizer`).

## Estrutura do repositorio

```
claw-kb/                              # CLI TypeScript + SQLite (knowledge base)
  src/                                # Codigo-fonte
  seed.ts                             # Popula fontes iniciais
  test.ts                             # Testes
skills/
  content-scout/                      # Varrer fontes e catalogar artigos
  content-advisor/                    # Analisar e agrupar temas
  content-recommender/                # Ler artigos e gerar briefings
  content-summarizer/                 # Resumir links/textos/PDFs sob demanda
docs/
  content-intelligence/               # Arquitetura e plano do pipeline
  fases/                              # Checklists de implementacao (3 fases)
  REFERENCIA-OPENCLAW.md              # Referencia tecnica do OpenClaw
  AJUSTES-SKILLS-v1.md                # Historico de ajustes e troubleshooting
.env.example                          # Template de variaveis de ambiente
CLAUDE.md                             # Contexto para Claude Code
```

---

## Requisitos

- VPS com Linux (Ubuntu/Debian recomendado) ou qualquer servidor com acesso SSH
- Node.js 22+ (necessario para `--experimental-strip-types`)
- Conta no Telegram + bot criado via [@BotFather](https://t.me/BotFather)
- API key de um provedor LLM (Gemini, Groq, Anthropic, OpenAI)

---

## 1. Instalar o OpenClaw

```bash
ssh root@<your-server-ip>

# Instalar Node.js (se nao tiver)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22

# Instalar OpenClaw
curl -fsSL https://get.openclaw.ai | bash

# Verificar
openclaw --version
```

Documentacao oficial: https://docs.openclaw.ai

---

## 2. Escolher o modelo LLM

Este pipeline exige um modelo que faca **tool calling** (chamar `exec`, `web_fetch`, `read`) de forma confiavel em fluxos multi-step.

### Modelos testados

| Modelo | Resultado | Notas |
|--------|-----------|-------|
| `google/gemini-2.5-flash` | **Funciona** | Unico que completou o pipeline de forma confiavel. Recomendado |
| `google/gemini-2.5-flash-lite` | Instavel | Funciona as vezes, mas retorna 0 tokens com frequencia. Trava em fluxos multi-step |
| `groq/moonshotai/kimi-k2-instruct` | Parcial | Bom conversacional, mas trava em fluxos de 3+ tool calls |
| `groq/qwen/qwen3-32b` | Nao funciona | Forte em raciocinio mas vaza thinking tags no output |
| `groq/meta-llama/llama-4-scout-17b-16e-instruct` | Parcial | Tool calling ok mas inconsistente em fluxos longos |
| `groq/llama-3.3-70b-versatile` | Nao funciona | Tool calling problematico |
| `openai/gpt-4o-mini` | Nao testado pipeline | Backup economico, deve funcionar |

**Recomendacao:** Use `google/gemini-2.5-flash`. O Flash Lite (versao menor) funciona para conversas simples mas e instavel no pipeline — retorna output vazio com frequencia em fluxos multi-step.

### Limitacoes conhecidas (Gemini Flash / Flash Lite)

- Flash Lite retorna 0 tokens se receber >9KB de tool result de uma vez
- Flash Lite trava em fluxos com 3+ tool calls sequenciais (resolvido com state machines no CLI)
- SKILL.md deve ter **menos de 3KB** — conteudo pesado vai em `references/`
- `maxTokens: 8192` e recomendado (sem isso Flash Lite retorna output vazio)

---

## 3. Configurar o OpenClaw

### 3.1 Copiar os arquivos do repo para a VPS

```bash
# No seu computador local
scp -r claw-kb/ root@<your-server-ip>:~/.openclaw/workspace/claw-kb/
scp -r skills/ root@<your-server-ip>:~/.openclaw/workspace/skills/

# Na VPS — instalar dependencias do claw-kb
cd ~/.openclaw/workspace/claw-kb
npm install
```

### 3.2 Criar link simbolico para o CLI (opcional)

```bash
ln -s ~/.openclaw/workspace/claw-kb/run.sh /usr/local/bin/claw-kb
chmod +x ~/.openclaw/workspace/claw-kb/run.sh
```

### 3.3 Configurar `~/.openclaw/openclaw.json`

```json
{
  "gateway": {
    "port": 18789,
    "loopback": true
  },
  "channels": {
    "telegram": {
      "enabled": true
    }
  },
  "models": {
    "default": "google/gemini-2.5-flash",
    "config": {
      "google/gemini-2.5-flash": {
        "maxTokens": 8192
      }
    }
  },
  "skills": {
    "load": {
      "watch": true
    }
  },
  "tools": {
    "elevated": {
      "allowFrom": {
        "telegram": ["direct"]
      }
    }
  }
}
```

> **IMPORTANTE:** `tools.elevated.allowFrom.telegram` deve ser `["direct"]` (array), NAO `true` (boolean). Se errar isso, as tools nao funcionam via Telegram.

### 3.4 Configurar autenticacao do modelo

```bash
# Para Gemini (recomendado)
openclaw models auth paste-token --provider google --profile-id google:default
# Cole sua GEMINI_API_KEY quando solicitado

# Verificar
openclaw models status
```

### 3.5 Configurar o bot do Telegram

No [@BotFather](https://t.me/BotFather):
1. Crie um bot com `/newbot`
2. Copie o token

```bash
# Configurar no OpenClaw
openclaw config set channels.telegram.botToken "<your-bot-token>"
```

---

## 4. Configurar o agente (personalidade e contexto)

O OpenClaw injeta automaticamente arquivos do `~/.openclaw/workspace/` no system prompt. Crie os seguintes:

### 4.1 `SOUL.md` — Personalidade

```markdown
Voce e um assistente de curadoria de conteudo especializado em AI, tech e negocios.

Tom:
- Direto e objetivo, sem enrolacao
- Pode dar opiniao, mas com base em dados
- Casual como um parceiro de trabalho

Limites:
- Nao inventar dados ou quotes
- Nao inflar conteudo mediano como revolucionario
- Se nao tem nada relevante, dizer isso
```

### 4.2 `IDENTITY.md` — Nome e identidade

```markdown
Nome: <nome-do-seu-bot>
```

### 4.3 `USER.md` — Perfil do usuario

```markdown
Nome: <seu-nome>
Cargo: <seu-cargo>
Contexto: <descreva brevemente o que voce faz>

Projetos ativos:
- <Projeto 1>: <descricao curta>
- <Projeto 2>: <descricao curta>
- <Projeto 3>: <descricao curta>

Providers/ferramentas que uso: <ex: Claude, Gemini, OpenAI>
```

Este perfil e usado pelas skills para personalizar scoring, insights e recomendacoes.

### 4.4 `AGENTS.md` — Instrucoes operacionais

```markdown
## Skills

Skills customizadas estao em ~/.openclaw/workspace/skills/<nome>/SKILL.md
Consulte o bloco <available_skills> no system prompt para o path exato.

## Regras

- Sempre responder em PT-BR
- Sem tabelas markdown (Telegram nao renderiza) — usar listas
- Se uma skill retornar done: false, continuar executando next_action ate done: true
- NUNCA mencionar tags <think> ou <final> — o OpenClaw gerencia isso automaticamente
```

### 4.5 (Opcional) Criar `projetos-usuario.md` nas skills

Se quiser que as skills advisor e recommender considerem seus projetos no scoring e nas recomendacoes, crie:

```bash
# Copiar template para as skills que usam
cat > ~/.openclaw/workspace/skills/content-advisor/references/projetos-usuario.md << 'EOF'
# Projetos do Usuario

1. **<Projeto 1>**: <descricao, stack, o que faz>
2. **<Projeto 2>**: <descricao, stack, o que faz>
3. **<Projeto 3>**: <descricao, stack, o que faz>
EOF
```

---

## 5. Popular fontes e testar

### 5.1 Adicionar suas fontes

O repo vem com o `seed.ts` vazio — voce configura as fontes que quiser. Pode fazer via CLI ou editando o seed:

```bash
cd ~/.openclaw/workspace/claw-kb

# Via CLI (uma por uma)
node --experimental-strip-types src/index.ts source add \
  --name "anthropic-blog" --type blog \
  --url "https://www.anthropic.com/news" \
  --priority P0 --frequency daily

node --experimental-strip-types src/index.ts source add \
  --name "hacker-news" --type rss \
  --url "https://news.ycombinator.com/rss" \
  --priority P1 --frequency "3x-week"

# Ou: edite seed.ts com suas fontes e rode
node --experimental-strip-types seed.ts
```

Tipos suportados: `rss`, `blog`, `newsletter`, `youtube`
Prioridades: `P0` (diario), `P1` (3x/semana), `P2` (semanal)

Veja mais exemplos em `skills/content-scout/references/sources-config.md`.

### 5.2 Iniciar o gateway

```bash
systemctl --user enable openclaw-gateway.service
systemctl --user start openclaw-gateway.service

# Verificar se subiu
openclaw health
```

### 5.3 Testar manualmente via Telegram

Envie mensagens no Telegram para o seu bot:

| Comando | O que faz |
|---------|-----------|
| "roda o scout P0" | Ingere fontes P0, aplica scoring, cataloga artigos |
| "analisa o que tem" | Advisor filtra e agrupa temas do que o scout catalogou |
| "gera recomendacoes" | Recommender le artigos e gera briefings |
| "resume isso: https://..." | Summarizer resume um link avulso |
| "o que tem de novo?" | Scout verifica todas as fontes |

### 5.4 Verificar o banco

```bash
cd ~/.openclaw/workspace/claw-kb
node --experimental-strip-types src/index.ts article stats
node --experimental-strip-types src/index.ts article list --status cataloged
node --experimental-strip-types src/index.ts rec list
```

---

## 6. Configurar cron jobs (automacao)

Para rodar o pipeline automaticamente sem intervencao manual:

```bash
# Scout P0 — todo dia as 7h
openclaw cron add --name "Scout P0" \
  --cron "0 7 * * *" --tz "<your-timezone>" \
  --session isolated \
  --message "Roda scout P0" \
  --announce --channel telegram --to "<your-telegram-id>"

# Scout P1 — seg/qua/sex as 7h30
openclaw cron add --name "Scout P1" \
  --cron "30 7 * * 1,3,5" --tz "<your-timezone>" \
  --session isolated \
  --message "Roda scout P1"

# Scout P2 — domingo as 8h
openclaw cron add --name "Scout P2" \
  --cron "0 8 * * 0" --tz "<your-timezone>" \
  --session isolated \
  --message "Roda scout P2"

# Advisor — todo dia as 9h (depois do scout)
openclaw cron add --name "Advisor" \
  --cron "0 9 * * *" --tz "<your-timezone>" \
  --session isolated \
  --message "Analisa os artigos catalogados e seleciona temas"

# Recommender — todo dia as 10h (depois do advisor)
openclaw cron add --name "Recommender" \
  --cron "0 10 * * *" --tz "<your-timezone>" \
  --session isolated \
  --message "Gera recomendacoes de conteudo" \
  --announce --channel telegram --to "<your-telegram-id>"

# Digest semanal — segunda as 8h
openclaw cron add --name "Digest Semanal" \
  --cron "0 8 * * 1" --tz "<your-timezone>" \
  --session isolated \
  --message "Gera digest semanal dos ultimos 7 dias" \
  --announce --channel telegram --to "<your-telegram-id>"
```

Gerenciar crons:

```bash
openclaw cron list              # ver jobs
openclaw cron run <id>          # forcar execucao
openclaw cron runs --id <id>    # historico
openclaw cron remove <id>       # remover
```

---

## 7. Scoring de relevancia

O scout avalia cada artigo com um sistema de scoring (0-10):

**Criterios positivos:**
- Projeto direto do usuario (+3)
- Ferramenta integravel a stack (+2)
- Provider que o usuario usa (+2)
- Tema publicavel com opiniao original (+2)
- Dados concretos / benchmarks (+1)
- Opiniao qualificada (+1)
- Tendencia emergente (2+ fontes em 7 dias) (+1)

**Criterios negativos:**
- Conteudo introdutorio / tutorial basico (-2)
- Noticia requentada (-3)
- Hype sem substancia (-2)
- Fora de escopo (-5)

Artigos com score 0-4 sao ignorados, 5-6 ficam como `ingested`, 7+ sao `cataloged` com resumo e tags.

Para personalizar o scoring, edite: `skills/content-scout/references/scoring-system.md`

---

## 8. Troubleshooting

### O bot nao responde no Telegram

```bash
# 1. Ver logs
openclaw logs --tail 50

# 2. Ver sessao mais recente
find ~/.openclaw -name "*.jsonl" -mmin -5

# 3. Limpar sessao e reiniciar
rm -f ~/.openclaw/agents/main/sessions/*.jsonl
systemctl --user restart openclaw-gateway.service
```

### Modelo retorna 0 tokens

- Verificar se `maxTokens: 8192` esta configurado
- Verificar se o SKILL.md tem menos de 3KB
- Limpar sessao (contexto antigo envenena o modelo)

### Tool calls nao funcionam

- `tools.elevated.allowFrom.telegram` deve ser `["direct"]` (array, NAO boolean)
- Verificar `openclaw models status` — auth pode estar em cooldown
- Resetar `usageStats` em `auth-profiles.json` se necessario

### Mudei uma skill e nao fez efeito

Sempre limpar sessao apos mudancas:

```bash
rm -f ~/.openclaw/agents/main/sessions/*.jsonl
systemctl --user restart openclaw-gateway.service
```

Se `skills.load.watch: true` estiver no config, skills sao recarregadas mid-session. Caso contrario, precisa de nova sessao.

### Reply tags (Gemini/Google)

O OpenClaw injeta automaticamente instrucoes de `<think>/<final>` para providers Google. **NUNCA** adicione regras sobre essas tags no AGENTS.md ou SKILL.md — isso conflita com o sistema automatico e trava o modelo.

---

## claw-kb CLI — Referencia rapida

```bash
cd ~/.openclaw/workspace/claw-kb
node --experimental-strip-types src/index.ts <command>
```

| Comando | Descricao |
|---------|-----------|
| `source add/list/check/enable/disable` | Gerenciar fontes RSS/blog/newsletter |
| `article add/list/search/get/stats` | Gerenciar artigos ingeridos |
| `article update --id N --status X` | Atualizar status de artigo |
| `scout start/feed/score/skip/status/reset` | State machine do scout |
| `rec-flow start/feed/skip/rec/done/status/reset` | State machine do recommender |
| `rec add/list/update/detail` | Gerenciar recomendacoes |
| `pub add/list/topics` | Registrar publicacoes feitas |
| `crossref --article-id N` | Cruzar artigo com publicacoes |
| `gaps --days 30` | Identificar gaps de conteudo |
| `digest --since 30d` | Gerar digest do periodo |
| `stats` | Estatisticas do banco |
| `export --format json` | Exportar dados |
| `prune --older-than 90d` | Limpar artigos antigos |

---

## Personalizacao

### Adicionar fontes

Edite `claw-kb/seed.ts` com suas fontes ou use o CLI:

```bash
node --experimental-strip-types src/index.ts source add \
  --name "nome" --type rss --url "https://..." --priority P1 --frequency "3x-week"
```

### Mudar criterios de scoring

Edite `skills/content-scout/references/scoring-system.md` com seus projetos e criterios.

### Mudar formato de output

- Resumos: `skills/content-summarizer/references/output-template.md`
- Recomendacoes: `skills/content-recommender/references/format-templates.md`
- NotebookLM: `skills/content-recommender/references/notebooklm-template.md`

### Mudar tom e preferencias

Edite `skills/content-summarizer/references/preferences.md`

---

## Documentacao do OpenClaw

- [Index](https://docs.openclaw.ai/llms.txt)
- [Skills](https://docs.openclaw.ai/tools/skills.md)
- [Creating skills](https://docs.openclaw.ai/tools/creating-skills.md)
- [Agent loop](https://docs.openclaw.ai/concepts/agent-loop.md)
- [System prompt](https://docs.openclaw.ai/concepts/system-prompt.md)
- [Google provider](https://docs.openclaw.ai/providers/google.md)
- [Config reference](https://docs.openclaw.ai/gateway/configuration-reference.md)

## Licenca

MIT — veja [LICENSE](LICENSE).
