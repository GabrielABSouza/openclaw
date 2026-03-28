# Bicho Antonio Bot - Configuração Completa do Agente

> Documento de referência gerado em 2026-03-28
> VPS Hostinger — `srv1516765` — `187.77.247.253`
> OpenClaw v2026.3.23-2

---

## 1. Infraestrutura

| Item | Valor |
|------|-------|
| VPS | Hostinger, hostname `srv1516765` |
| SSH | `ssh root@187.77.247.253` |
| Node.js | v22.22.1 |
| OpenClaw | 2026.3.23-2 (update 2026.3.24 disponível) |
| State dir | `/root/.openclaw/` (permissões 700) |
| Config | `/root/.openclaw/openclaw.json` (permissões 600) |
| Workspace | `/root/.openclaw/workspace/` |
| Systemd | `systemctl --user restart openclaw-gateway` |
| Unit file | `/root/.config/systemd/user/openclaw-gateway.service` |
| Log | `/tmp/openclaw/openclaw-2026-03-28.log` |

## 2. Gateway

| Parâmetro | Valor |
|-----------|-------|
| Porta | 18789 |
| Bind | loopback only |
| Auth | token: `1741c69...` |
| Tailscale | off |
| Browser | porta 18791 (loopback, token auth) |

## 3. Modelo & Providers

### Ativo
| Provider | Modelo | API Key env var |
|----------|--------|-----------------|
| **Google (Gemini)** | `google/gemini-2.5-flash-lite` | `GEMINI_API_KEY` |

### Legado (ainda no config)
| Provider | Modelo | API Key env var |
|----------|--------|-----------------|
| Groq | `moonshotai/kimi-k2-instruct` / `gpt-oss-120b` | `GROQ_API_KEY` |

**Nota:** O auth profile `openai:default` e as variáveis `OPENAI_BASE_URL`/`OPENAI_MODEL` ainda apontam para Groq. São resquícios da config anterior.

## 4. Canal: Telegram

| Parâmetro | Valor |
|-----------|-------|
| Bot | `@BichoAntonioBot` |
| Bot ID | `8791649178` |
| DM Policy | `pairing` |
| Group Policy | `allowlist` |
| Streaming | `partial` |
| Allowed User ID | `7129223306` (Gabriel) |
| Session scope | `per-channel-peer` |

## 5. Identidade & Personalidade

### IDENTITY.md
- Nome: **Bicho Antonio Bot** (Antonio)
- Emoji: lagarto
- "Braço direito digital" do Gabriel

### SOUL.md (regras de personalidade)
- Fala como pessoa, não chatbot
- Espelha tom e gírias do Gabriel
- Tem opiniões, pode discordar
- Resolve antes de perguntar
- Idiomas: PT-BR (padrão), English, Spanish — adapta automaticamente
- Conciso por padrão, sem emoji excessivo
- Sem tabelas markdown no Telegram
- Privacy-first: pede permissão antes de ações externas

### USER.md
- Gabriel Bastos — Head de AI / AI Consultant
- Timezone: America/Sao_Paulo (BRT, UTC-3)
- 4 projetos ativos documentados

### AGENTS.md (rotina de startup)
1. Lê SOUL.md, USER.md, IDENTITY.md
2. Lê arquivos de memória diários
3. Ativa skills
4. Aplica regras de formatação Telegram

## 6. Skills

### content-summarizer
- **Trigger:** links, texto colado, PDFs, imagens, áudio
- **Fluxo:** Carrega preferências → Identifica tipo → Detecta tools/repos → Classifica → Gera resumo estruturado → Salva no workspace
- **Estrutura de output:**
  - TL;DR
  - Pontos-chave
  - Insights (por projeto)
  - Hot take
  - Quotables
  - Pra aprofundar
  - Ideias de conteúdo
  - Categoria
- **Detecção de tools/repos:** Seção extra com análise de integração
- **Auto-save:** `/root/.openclaw/workspace/knowledge/<categoria>/<date>-<slug>.md`
- **Referências:**
  - `preferences.md` — tom (casual/direto), estrutura, regras
  - `projetos-gabriel.md` — 5 projetos documentados

### feedback-loop
- **Função:** Auto-ajusta comportamento baseado em feedback do usuário
- **Gerencia:** `preferences.md` do content-summarizer
- **Changelog:** `feedback-loop/references/changelog.md`
- **Classificação:** Tom, Estrutura, Conteúdo, Regra específica
- **Pode editar:** SKILL.md do content-summarizer para mudanças estruturais

## 7. Dispositivos Pareados

| Tipo | Plataforma | Scopes |
|------|-----------|--------|
| WebChat | MacIntel | admin, approvals, pairing |
| CLI | linux | read, admin, write, approvals, pairing (full) |

## 8. Cron Jobs
**Nenhum configurado.** O array de jobs está vazio.

## 9. Knowledge Base
Diretórios criados mas **todos vazios**:
`ai`, `carreira`, `financas`, `marketing`, `negocios`, `outros`, `produtividade`, `tech`, `tools`

## 10. Skills Desabilitadas (built-in)
- healthcheck
- node-connect
- tmux
- weather
- skill-creator

## 11. Tools Profile
`coding` — perfil padrão para ferramentas de desenvolvimento

## 12. Memória
- Armazenada em SQLite: `/root/.openclaw/memory/main.sqlite` (68KB)
- Sem arquivos de texto de memória

## 13. Backups
- 5 backups de config: `openclaw.json.bak` até `.bak.4` (de 2026-03-24)
- Config audit log: `/root/.openclaw/logs/config-audit.jsonl`
- 5 backups de sessão do agente

---

## 14. Sugestões de Otimização

### ALTA PRIORIDADE

#### 14.1 Limpar config legada do Groq
O `openclaw.json` ainda tem `OPENAI_BASE_URL` apontando para Groq, `OPENAI_MODEL: gpt-oss-120b`, e o auth profile `openai:default` com provider Groq. Isso pode causar confusão se alguma skill ou fallback tentar usar o provider OpenAI.
- **Ação:** Remover `OPENAI_BASE_URL`, `OPENAI_MODEL`, `GROQ_API_KEY` do bloco `env` e limpar o auth profile `openai:default`, ou reconfigurar para Gemini.

#### 14.2 Resetar sessão do agente
A última sessão ainda referencia `moonshotai/kimi-k2-instruct` via Groq. Context antigo pode poluir respostas do Gemini.
- **Ação:** `openclaw agent reset` ou deletar a sessão ativa.

#### 14.3 Atualizar OpenClaw para 2026.3.24
Há uma versão mais nova disponível.
- **Ação:** `npm update -g openclaw`

### MÉDIA PRIORIDADE

#### 14.4 Configurar cron jobs para automação
O knowledge base está vazio e não há jobs agendados. O content-summarizer salva resumos, mas ninguém está alimentando links automaticamente.
- **Ação:** Criar cron jobs para:
  - Scraping de feeds/newsletters (RSS, Twitter, etc.)
  - Processamento automático de links pendentes
  - Relatório diário/semanal de resumos acumulados

#### 14.5 Habilitar skill healthcheck
Está desabilitada. Com o bot rodando 24/7, ter health monitoring ajuda a detectar problemas antes que afetem o uso.
- **Ação:** `"healthcheck": { "enabled": true }` no config

#### 14.6 Configurar HEARTBEAT.md
O arquivo está vazio. Heartbeat permite tarefas periódicas como limpeza de memória, verificação de status, ou resumo diário.
- **Ação:** Definir tarefas recorrentes que o agente deve executar automaticamente.

### BAIXA PRIORIDADE

#### 14.7 Mover secrets para .env
Embora o `openclaw.json` tenha permissões 600, separar secrets (API keys, bot token) em `/root/.openclaw/.env` é uma prática melhor — evita que backups de config exponham chaves.
- **Ação:** Criar `.env` e mover `GEMINI_API_KEY`, `GROQ_API_KEY`, e bot token para lá.

#### 14.8 Configurar Tailscale para acesso remoto seguro
Atualmente desligado. Se quiser acessar o gateway de fora sem expor portas, Tailscale seria o caminho.

#### 14.9 Habilitar skill-creator
Está desabilitada, mas pode ser útil para criar novas skills sob demanda direto pelo Telegram.

#### 14.10 Revisar denied commands no gateway
A lista atual bloqueia `camera.snap`, `contacts.add`, etc. — faz sentido para segurança, mas verificar se algum comando útil está bloqueado desnecessariamente.
