# OpenClaw - Referência Técnica para o Projeto do Gabriel

> Documento de referência interno para minimizar erros de implementação.
> Baseado na documentação oficial, repos do Bruno Okamoto e comunidade.

---

## 1. Arquitetura Geral

- **Gateway**: Daemon principal que gerencia todos os canais (Telegram, WhatsApp, Discord, etc.)
- **Agent Runtime**: Motor de IA que processa mensagens, gerencia sessões e executa tools
- **Workspace**: `/root/.openclaw/workspace/` — arquivos de contexto injetados a cada sessão
- **Config**: `/root/.openclaw/openclaw.json` — configuração central
- **Sessions**: JSONL em `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`

### Arquivos de Bootstrap (injetados automaticamente)
| Arquivo | Função |
|---------|--------|
| `AGENTS.md` | Instruções operacionais, regras de memória, comportamento em grupos |
| `SOUL.md` | Persona, tom, limites |
| `IDENTITY.md` | Nome, vibe, emoji |
| `USER.md` | Perfil do usuário |
| `TOOLS.md` | Notas locais sobre ferramentas |
| `HEARTBEAT.md` | Checklist para heartbeats periódicos |

---

## 2. Configuração Atual na VPS

```
VPS: srv1516765 (187.77.247.253)
OpenClaw: 2026.3.23-2
Modelo: groq/moonshotai/kimi-k2-instruct (128k ctx)
Canal: Telegram (@BichoAntonioBot)
Workspace: /root/.openclaw/workspace/
Gateway port: 18789 (loopback)
```

### Modelos configurados
- `groq/moonshotai/kimi-k2-instruct` — default (conversacional, rápido)
- `openai/gpt-5.1-codex` — alias "GPT" (capacidade avançada)
- `openai/gpt-4o-mini` — backup econômico

### Modelos Groq disponíveis (free tier)
- `meta-llama/llama-4-scout-17b-16e-instruct` — bom tool calling
- `qwen/qwen3-32b` — forte em raciocínio (mas vaza thinking tags)
- `moonshotai/kimi-k2-instruct` — excelente conversacional (ATUAL)
- `openai/gpt-oss-120b` — potente mas 8k TPM no free tier
- `openai/gpt-oss-20b` — reasoning model, limites melhores
- `llama-3.3-70b-versatile` — bom mas tool calling problemático

---

## 3. Skills (Habilidades do Agente)

### Estrutura de uma Skill
```
skill-name/
├── SKILL.md          # Frontmatter YAML + instruções (obrigatório)
├── evals/
│   └── evals.json    # Casos de teste
├── references/       # Documentação de apoio
├── scripts/          # Código executável
└── assets/           # Templates, fontes, arquivos estáticos
```

### SKILL.md — Frontmatter obrigatório
```yaml
---
name: nome-da-skill
description: "Descrição curta que o agente usa para decidir quando ativar"
---
```

### Frontmatter opcional
- `homepage` — URL de referência
- `user-invocable` — permite invocar via `/nome-da-skill`
- `disable-model-invocation` — desabilita ativação automática pelo modelo
- `command-dispatch` — roteamento de sub-comandos
- `command-tool` — tool associada ao comando
- `command-arg-mode` — como argumentos são passados

### Locais de carregamento (por precedência)
1. **Workspace skills**: `<workspace>/skills/` (maior prioridade)
2. **Managed skills**: `~/.openclaw/skills/`
3. **Bundled skills**: instaladas com OpenClaw

### Skills bundled disponíveis
- `healthcheck` — Auditoria de segurança do host
- `node-connect` — Diagnóstico de conexão de nodes
- `skill-creator` — Criar/editar skills
- `tmux` — Controle remoto de sessões tmux
- `weather` — Previsão do tempo via wttr.in

### Configuração no openclaw.json
```json
{
  "skills": {
    "entries": {
      "minha-skill": {
        "enabled": true,
        "env": { "API_KEY": "xxx" }
      }
    },
    "load": {
      "extraDirs": ["/caminho/para/skills/extras"],
      "watch": true
    }
  }
}
```

### Gating (requisitos para ativar)
```yaml
metadata:
  openclaw:
    requires:
      bins: [jq, curl]
      env: [MY_API_KEY]
      config: [some.config.path]
    os: [linux, darwin]
```

---

## 4. Cron Jobs (Agendamentos)

### Tipos de schedule
- **One-shot (`at`)**: ISO 8601, auto-deleta após execução
- **Intervalo fixo (`every`)**: em milissegundos
- **Expressão cron (`cron`)**: 5 ou 6 campos + timezone IANA

### Modos de sessão
- `main` — roda no heartbeat da sessão principal (com contexto)
- `isolated` — sessão dedicada `cron:<jobId>` (limpo)
- `session:custom-id` — sessão nomeada persistente

### Delivery (como entrega o resultado)
- `announce` — envia pro canal (Telegram, WhatsApp, etc.)
- `webhook` — POST para URL externa
- `none` — só interno

### Exemplos CLI

```bash
# Briefing diário às 7h (Brasília)
openclaw cron add --name "Briefing matinal" \
  --cron "0 7 * * *" --tz "America/Sao_Paulo" \
  --session isolated \
  --message "Faça um resumo das últimas notícias de AI, tech e mercado financeiro." \
  --announce --channel telegram --to "7129223306"

# Lembrete one-shot
openclaw cron add --name "Lembrete reunião" \
  --at "2026-03-25T14:00:00-03:00" \
  --session main --system-event "Reunião em 30 minutos" \
  --wake now --delete-after-run

# Job semanal com modelo específico
openclaw cron add --name "Análise semanal" \
  --cron "0 9 * * 1" --tz "America/Sao_Paulo" \
  --session isolated \
  --message "Análise semanal dos projetos" \
  --model "openai/gpt-5.1-codex" \
  --announce --channel telegram --to "7129223306"
```

### Gerenciamento
```bash
openclaw cron list              # listar jobs
openclaw cron edit <id> ...     # editar
openclaw cron remove <id>       # remover
openclaw cron run <id>          # forçar execução
openclaw cron runs --id <id>    # histórico
```

### Retry automático
- **One-shot**: 3 tentativas com backoff (30s → 1m → 5m)
- **Recurring**: backoff exponencial (30s → 1m → 5m → 15m → 60m), reseta após sucesso

---

## 5. Standing Orders (Ordens Permanentes)

Autorizações permanentes no `AGENTS.md` para o agente agir autonomamente.

### Estrutura de uma Standing Order
1. **Scope** — ações autorizadas e limites
2. **Triggers** — quando executar (schedule, evento, condição)
3. **Approval gates** — o que precisa de aprovação humana
4. **Escalation rules** — quando parar e pedir ajuda
5. **Execution steps** — procedimento específico
6. **Prohibitions** — o que NÃO fazer

### Padrão de execução: Execute → Verify → Report
1. **Executa** a tarefa
2. **Verifica** que funcionou (arquivo existe, dados corretos)
3. **Reporta** o que foi feito

### Combinação com Cron
- Standing Order define **o quê** o agente pode fazer
- Cron Job define **quando** ele faz
- Ex: Standing Order "Você gerencia o triage de inbox" + Cron "8h diário"

---

## 6. Hooks (Event-Driven)

### Tipos de eventos
- `message:received` — mensagem recebida
- `message:transcribed` — áudio transcrito
- `message:preprocessed` — após entendimento de mídia/links
- `message:sent` — mensagem enviada
- `command:new/reset/stop` — comandos de sessão
- `agent:bootstrap` — antes do bootstrap do workspace
- `gateway:startup` — após canais iniciarem

### Hooks bundled
- `session-memory` — salva snapshot da sessão ao resetar
- `bootstrap-extra-files` — injeta arquivos extras no bootstrap
- `command-logger` — log de comandos para auditoria

### Estrutura de um hook custom
```
~/.openclaw/hooks/meu-hook/
├── HOOK.md       # Metadata YAML + documentação
└── handler.ts    # Implementação TypeScript
```

---

## 7. Webhooks (Triggers Externos)

Permitem sistemas externos acionarem o agente via HTTP.

### Endpoints
- `POST /hooks/wake` — enfileira evento no heartbeat
- `POST /hooks/agent` — roda turn isolado do agente
- `POST /hooks/<name>` — hooks mapeados customizados

### Autenticação
```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -d '{"message":"Resuma o inbox","model":"openai/gpt-5.1-codex"}'
```

### Config
```json
{
  "hooks": {
    "enabled": true,
    "token": "seu-token-secreto",
    "path": "/hooks",
    "defaultSessionKey": "hook:ingress"
  }
}
```

---

## 8. Heartbeats (Proatividade)

O agente recebe "pulsos" periódicos (padrão: 30min) para verificar tarefas pendentes.

### Config em HEARTBEAT.md
Adicionar checklist de coisas para verificar:
- Emails urgentes
- Calendário próximas 24h
- Menções em redes sociais
- Notícias relevantes

### Quando agir vs ficar quieto
- **Agir**: email importante, evento próximo, info relevante encontrada
- **Quieto**: madrugada (23h-8h), humano ocupado, nada novo, checou há <30min

---

## 9. Tools Disponíveis para o Agente

### Ferramentas built-in
| Tool | Função |
|------|--------|
| `read` | Ler arquivos do workspace |
| `write` | Escrever arquivos |
| `edit` | Editar arquivos existentes |
| `exec` | Executar comandos no terminal |
| `process` | Gerenciar processos |
| `web_search` | Buscar na web |
| `web_fetch` | Buscar conteúdo de URL específica |
| `image` | Gerar/processar imagens |
| `memory_search` | Buscar na memória vetorial |
| `memory_get` | Recuperar memória específica |
| `sessions_list` | Listar sessões |
| `sessions_history` | Ver histórico de sessão |
| `sessions_send` | Enviar mensagem para outra sessão |
| `sessions_spawn` | Criar sub-agente |
| `sessions_yield` | Ceder controle |
| `subagents` | Gerenciar sub-agentes |
| `session_status` | Status da sessão atual |

### Web Search — Providers disponíveis
| Provider | Auth | Destaque |
|----------|------|----------|
| DuckDuckGo | Não | Fallback sem chave |
| Brave | Sim | Snippets estruturados |
| Perplexity | Sim | Extração de conteúdo |
| Tavily | Sim | Filtro por tópico |
| Gemini | Sim | Resposta sintetizada com citações |
| Exa | Sim | Busca neural |

---

## 10. Recursos dos Repos da Comunidade

### Bruno Okamoto (openclaw-BrunoOkamoto)
- Templates prontos: SOUL.md, IDENTITY.md, USER.md, AGENTS.md, MEMORY, HEARTBEAT
- Skills: `deep-research/` (pesquisa web), `seguranca/` (segurança)
- 12 categorias de use cases: Conteúdo, Business, Suporte, Comunidade, Research, Produtividade
- Prompts guiados por módulo
- Configs de exemplo
- QA: 35+ soluções de troubleshooting

### Skill Creator (okjpg/skill-creator)
- Ferramenta para gerar skills automaticamente
- Invocável via `/criar-skill`
- Pipeline: Descrição → Estruturação → QA (10 checks) → Deploy
- Wizard visual em HTML
- 24 templates de exemplo
- Instalação: `curl -fsSL https://raw.githubusercontent.com/okjpg/skill-creator/main/install.sh | bash`

### Awesome OpenClaw Skills (VoltAgent)
- 5.211 skills curadas de 13.729 na registry
- Categorias relevantes para nosso uso:
  - **Search & Research** (345 skills) — busca e análise de informação
  - **Browser & Automation** (322 skills) — web automation, scraping
  - **Marketing & Sales** (102 skills) — campanhas, leads
  - **Communication** (146 skills) — mensageria, email
  - **Productivity & Tasks** (205 skills) — gestão de projetos
  - **AI & LLMs** (176 skills) — integração de modelos
- Instalação: `clawhub install <skill-slug>` ou copiar para `~/.openclaw/skills/`

---

## 11. Sugestões de Skills/Tools para os Objetivos do Gabriel

### Objetivo 1: Scraping de Redes Sociais / Canais de Notícia
| Ferramenta | Como usar |
|------------|-----------|
| `web_fetch` | Buscar conteúdo de URLs específicas (artigos, threads) |
| `web_search` | Buscar notícias e tendências |
| `web_browser` | Sites que precisam de JS/login (Twitter, LinkedIn) |
| Skill custom `scraper` | Automatizar coleta de fontes específicas via cron |
| Brave/Perplexity API | Busca estruturada com snippets |

### Objetivo 2: Ler Newsletters / Notícias / Papers
| Ferramenta | Como usar |
|------------|-----------|
| `web_fetch` | Extrair conteúdo de URLs de newsletters |
| Gmail PubSub hook | Trigger automático quando newsletter chega no email |
| Webhook endpoint | Integrar com Zapier/Make para receber emails |
| Skill custom `reader` | Processar e resumir conteúdo automaticamente |
| `memory_search/get` | Armazenar e recuperar resumos anteriores |

### Objetivo 3: Gerar Resumos e Contexto para Produção de Conteúdo
| Ferramenta | Como usar |
|------------|-----------|
| Standing Order | "Você processa todo conteúdo recebido e gera resumo estruturado" |
| Cron Job diário | Briefing matinal com resumo das últimas 24h |
| Cron Job semanal | Compilado semanal de insights e tendências |
| Skill `deep-research` | Pesquisa aprofundada sobre tópicos específicos |
| `write` + workspace | Salvar documentos estruturados no workspace |
| `sessions_send` | Enviar resumos pro Telegram automaticamente |

### Objetivo 4: Jobs Automatizados (Links, Imagens, Áudios)
| Ferramenta | Como usar |
|------------|-----------|
| `message:received` hook | Processar automaticamente qualquer conteúdo recebido |
| `message:transcribed` hook | Transcrever e resumir áudios automaticamente |
| `image` tool | Processar imagens recebidas (OCR, descrição) |
| `web_fetch` | Quando recebe um link, buscar e resumir o conteúdo |
| Webhook | Receber triggers de outros sistemas (Zapier, n8n, etc.) |

---

## 12. Plano de Implementação Sugerido

### Fase 1: Fundação (atual)
- [x] Gateway funcionando com Telegram
- [x] Modelo configurado (Kimi K2)
- [x] Personalidade definida (SOUL, IDENTITY, USER)
- [ ] Instalar skill-creator
- [ ] Configurar web search provider (DuckDuckGo gratuito ou Brave)

### Fase 2: Skills de Produtividade
- [ ] Criar skill `content-summarizer` — resumir links/artigos/newsletters
- [ ] Criar skill `daily-briefing` — compilar notícias do dia
- [ ] Criar skill `audio-notes` — transcrever e resumir áudios
- [ ] Configurar `deep-research` do repo do Bruno

### Fase 3: Automação
- [ ] Standing Orders no AGENTS.md para processamento autônomo
- [ ] Cron jobs: briefing matinal, compilado semanal
- [ ] HEARTBEAT.md com checklist de verificações periódicas
- [ ] Hooks para processamento automático de mídia recebida

### Fase 4: Integração Avançada
- [ ] Webhooks para receber triggers externos (email, RSS)
- [ ] Integração com workflow de produção de conteúdo
- [ ] Memória vetorial para acumular conhecimento ao longo do tempo
- [ ] Sub-agentes especializados (research, writing, analysis)

---

## 13. Autenticação — API Key vs OAuth (Setup Token)

O OpenClaw suporta dois modos de autenticação para a Anthropic:

### Modos de auth
| Modo | Token prefix | Header enviado | Billing |
|------|-------------|----------------|---------|
| API Key | `sk-ant-api03-...` | `x-api-key: <token>` | Pay-per-token |
| OAuth (setup-token) | `sk-ant-oat01-...` | `Authorization: Bearer <token>` + `anthropic-beta: oauth-2025-04-20` | Subscription (plano Claude Pro/Max) |

### Como gerar um setup-token
No computador que tem o Claude CLI instalado e logado:
```bash
claude setup-token
```
Isso gera um token `sk-ant-oat01-...` vinculado à subscription do usuário.

### Como configurar no OpenClaw (CORRETO)

**Regra crítica**: O `auth-profiles.json` usa `type: "token"` com campo `token` — **NÃO usar `type: "oauth"`**.
O OpenClaw detecta automaticamente tokens `sk-ant-oat` pelo prefixo e adiciona os headers OAuth necessários.

#### 1. Editar `~/.openclaw/agents/main/agent/auth-profiles.json`
```json
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "token",
      "provider": "anthropic",
      "token": "sk-ant-oat01-SEU_TOKEN_AQUI"
    }
  },
  "lastGood": { "anthropic": "anthropic:default" },
  "usageStats": { "anthropic:default": { "errorCount": 0 } }
}
```

#### 2. Editar `~/.openclaw/openclaw.json` (seção auth)
```json
{
  "auth": {
    "profiles": {
      "anthropic:default": {
        "provider": "anthropic",
        "mode": "token"
      }
    },
    "order": {
      "anthropic": ["anthropic:default"]
    }
  }
}
```

#### 3. Reiniciar o gateway
```bash
systemctl --user restart openclaw-gateway
```

### Armadilhas encontradas (NÃO FAZER)

1. **NÃO usar `type: "oauth"` no auth-profiles.json** — A função `resolveApiKeyFromCredential` do OpenClaw só processa `type: "api_key"` e `type: "token"`. Tipo `"oauth"` é ignorado silenciosamente e faz fallback para o próximo perfil (que pode ter uma key inválida).

2. **NÃO usar campo `access` em vez de `token`** — Mesmo com type "oauth", o campo `access` não é lido pelo resolver de API key. Sempre usar `token`.

3. **NÃO usar `mode: "oauth"` ou `mode: "api_key"` no openclaw.json** — Usar `mode: "token"` para setup-tokens.

4. **Sempre resetar `usageStats`** após mudanças de auth — O OpenClaw tem cooldown exponencial para perfis que falham. Se não resetar, o perfil pode ficar em cooldown por horas.

### Como funciona internamente
1. `resolveApiKeyFromCredential` lê o campo `token` do perfil `type: "token"`
2. Token é passado como `options.apiKey` para a função de streaming
3. `isAnthropicOAuthApiKey(apiKey)` detecta o prefixo `sk-ant-oat`
4. Se OAuth detectado, adiciona `anthropic-beta: oauth-2025-04-20` aos headers
5. SDK envia como `Authorization: Bearer` (não `x-api-key`)

### Validação rápida (curl)
```bash
# Testar token OAuth diretamente (requer header beta)
curl -s https://api.anthropic.com/v1/messages \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-ant-oat01-SEU_TOKEN' \
  -H 'anthropic-version: 2023-06-01' \
  -H 'anthropic-beta: oauth-2025-04-20' \
  -d '{"model":"claude-haiku-4-5","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### Via CLI (alternativa)
```bash
export PATH=/root/.nvm/versions/node/v22.22.1/bin:$PATH
openclaw models auth paste-token --provider anthropic --profile-id anthropic:default
# Cole o token quando solicitado
openclaw models status  # Verificar auth
openclaw agent --agent main --message 'teste'  # Testar
```

---

## 14. Comandos Úteis de Referência

```bash
# Gerenciamento
openclaw health                    # status geral
openclaw gateway restart           # reiniciar gateway
openclaw config set <key> <value>  # alterar config
openclaw models list               # modelos disponíveis
openclaw sessions                  # listar sessões
openclaw sessions cleanup          # limpeza de sessões

# Skills
openclaw skills list               # listar skills
openclaw skills install <slug>     # instalar skill do ClawHub

# Cron
openclaw cron list                 # listar jobs
openclaw cron add ...              # criar job
openclaw cron run <id>             # forçar execução
openclaw cron runs --id <id>       # histórico

# Hooks
openclaw hooks list                # listar hooks
openclaw hooks enable <name>       # habilitar hook
openclaw hooks info <name>         # info detalhada

# Logs
openclaw logs --tail 50            # últimos 50 logs

# Conexão SSH
ssh root@187.77.247.253
```

---

## 15. Reply Tags (Reasoning Tag Providers)

O OpenClaw usa um sistema de "reply tags" para modelos que não possuem API nativa de thinking/reasoning.

### Quais providers usam reply tags
```javascript
function isReasoningTagProvider(provider) {
    // Google/Gemini, Google Gemini CLI, Minimax
    if (normalized === "google" || normalized === "google-gemini-cli" ||
        normalized === "google-generative-ai") return true;
    if (normalized.includes("minimax")) return true;
    return false;
}
```

### O que é injetado no system prompt
Quando o provider é um "reasoning tag provider", o OpenClaw adiciona automaticamente:
- "ALL internal reasoning MUST be inside `<think>...</think>`"
- "Format every reply as `<think>...</think>` then `<final>...</final>`, with no other text."
- "Only text inside `<final>` is shown to the user; everything else is discarded."

### Como o processamento funciona
1. `stripBlockTags()` processa o texto do modelo
2. Remove todo conteúdo dentro de `<think>` tags
3. Se `enforceFinalTag = true`: só entrega conteúdo dentro de `<final>` tags
4. Se `enforceFinalTag = false`: strip as tags mas mantém o conteúdo
5. Tags dentro de code spans são preservadas (não processadas)

### REGRAS CRÍTICAS
- **NUNCA** adicionar regras no AGENTS.md sobre `<think>` ou `<final>` — isso conflita com as instruções automáticas do OpenClaw
- **NUNCA** mencionar `<final>` em AGENTS.md ou SKILL.md — o modelo pode confundir e emitir `<final>` prematuramente
- O sistema de reply tags é totalmente gerenciado pelo OpenClaw — não interferir
- Se o modelo não responde no Telegram, verificar se o conteúdo dentro de `<final>` está sendo gerado corretamente nos logs da sessão

### Fluxo completo de uma resposta
1. OpenClaw constrói system prompt com reply tag instructions
2. Modelo responde: `<think>raciocínio</think><final>resposta visível</final>`
3. `stripBlockTags()` extrai conteúdo de `<final>`, descarta `<think>`
4. Conteúdo limpo passa pelo markdown renderer (Telegram = HTML)
5. Texto é enviado via block streaming ao canal

### Debug: verificar nos logs da sessão
```bash
# Ver session JSONL mais recente
find /root/.openclaw -name "*.jsonl" -mmin -5

# Extrair texto do assistant
cat <session>.jsonl | python3 -c "
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    if d.get('type')=='message' and d.get('message',{}).get('role')=='assistant':
        for c in d['message']['content']:
            if c.get('type')=='text':
                print(c['text'][:500])
"
```

---

## 16. Agent Loop — Referência Rápida

### Fluxo principal
intake → context assembly → model inference → tool execution → streaming replies → persistence

### Queueing
- Runs são serializados por session key (evita race conditions)
- Channels escolhem modo de fila: collect/steer/followup

### Reply shaping
- `NO_REPLY` é token silencioso (filtrado do output)
- Messaging tool duplicates são removidos
- Se não resta conteúdo renderizável e houve erro de tool, emite fallback error

### Streaming
- Block streaming emite chunks parciais em `text_end` ou `message_end`
- Preview streaming (Telegram `partial`) atualiza mensagem temporária durante geração
- Não existe token-delta streaming direto para canais

### Session lifecycle
- Skills são snapshotted no início da sessão e reusados
- Mudanças em skills requerem nova sessão (ou skills watcher habilitado)
- Sempre limpar sessão após mudanças em skills: `rm /root/.openclaw/agents/main/sessions/*.jsonl`

### Timeouts
- agent.wait: 30s (default)
- Agent runtime: 172800s (48h)

---

## 17. Skills — Como o Modelo Interage

### Injeção no system prompt
Skills elegíveis são listadas como "compact XML list of available skills" (~97 chars por skill).

### Ativação
1. O modelo decide ativar baseado no `description` do frontmatter
2. Modelo usa `read` tool para ler o SKILL.md
3. Modelo segue as instruções do SKILL.md

### Precedência de carregamento
1. Workspace: `<workspace>/skills/` (MAIOR prioridade)
2. Project agent: `<workspace>/.agents/skills/`
3. Personal agent: `~/.agents/skills/`
4. Managed/local: `~/.openclaw/skills/`
5. Bundled: instaladas com OpenClaw
6. Extra dirs: `skills.load.extraDirs`

### Session snapshot
- Skills são snapshotted ao iniciar sessão
- Mudanças só tomam efeito em nova sessão
- `skills.load.watch: true` permite refresh mid-session

---

_Documento gerado em 2026-03-24. Atualizado em 2026-03-28 com reply tags, agent loop e skills._
