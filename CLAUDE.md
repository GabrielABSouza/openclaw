# OpenClaw Content Intelligence — Contexto para Claude Code

## Quem sou eu
<your-name>, <your-role>. Uso OpenClaw como assistente pessoal via Telegram (<your-bot>) para curadoria de conteudo, resumos estruturados e producao de conteudo para redes sociais.

## Ambiente
- **VPS**: <your-provider> <your-hostname> (<your-server-ip>)
- **OpenClaw**: v2026.3.23-2
- **Modelo**: `google/gemini-2.5-flash` (maxTokens: 8192 configurado)
- **Canal**: Telegram
- **Workspace**: `~/.openclaw/workspace/`
- **Config**: `~/.openclaw/openclaw.json`
- **Gateway**: porta 18789 (loopback), systemd `openclaw-gateway.service`

## Estrutura do projeto

### claw-kb (CLI de Knowledge Base)
Caminho: `~/.openclaw/workspace/claw-kb/`
Runtime: `node --experimental-strip-types src/index.ts <command>`
DB: SQLite em `claw-kb/content.db`

Comandos principais:
- `source add/list/check/enable/disable` — gerenciar fontes
- `article add/update/list/search/get/exists/stats` — gerenciar artigos
- `rec add/list/update/detail` — recomendacoes de conteudo
- `pub add/list/topics` — publicacoes
- `crossref/gaps/digest` — analise
- `stats/export/prune` — manutencao
- `scout start/feed/score/skip/status/reset` — state machine do scout
- `rec-flow start/feed/skip/rec/done/status/reset` — state machine do recommender

### Skills (em `~/.openclaw/workspace/skills/`)
- **content-summarizer**: Resumir links/textos/PDFs com template estruturado
- **content-scout**: Varrer fontes e catalogar artigos (usa claw-kb scout)
- **content-advisor**: Analisar e agrupar temas para recomendacao
- **content-recommender**: Ler artigos e gerar briefings (usa claw-kb rec-flow)

Cada skill tem: `SKILL.md` (< 3KB), `evals/evals.json`, `references/` (templates e configs)

### Documentacao
- `docs/REFERENCIA-OPENCLAW.md` — referencia tecnica completa (17 secoes)
- `docs/content-intelligence/ARQUITETURA-CONTENT-INTELLIGENCE.md` — arquitetura do pipeline

## Reply Tags — CRITICO (nao mexer)

O OpenClaw injeta automaticamente instrucoes de `<think>/<final>` no system prompt para providers Google/Gemini (`isReasoningTagProvider`). O modelo deve responder com `<think>raciocinio</think><final>resposta</final>`.

**REGRAS:**
- NUNCA adicionar regras sobre `<think>` ou `<final>` no AGENTS.md ou SKILL.md
- NUNCA mencionar essas tags em instrucoes para o modelo
- O OpenClaw faz strip automatico via `stripBlockTags()` — so conteudo dentro de `<final>` chega no Telegram
- Se o modelo nao responde no Telegram, verificar nos logs se o conteudo de `<final>` esta sendo gerado

## Operacoes comuns

### Reiniciar gateway (limpo)
```bash
rm -f ~/.openclaw/agents/main/sessions/*.jsonl
systemctl --user restart openclaw-gateway.service
```

### Ver logs da sessao
```bash
find ~/.openclaw -name "*.jsonl" -mmin -5
cat <session>.jsonl | python3 -c "
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    if d.get('type')=='message':
        msg = d['message']
        role = msg.get('role','')
        usage = msg.get('usage',{})
        stop = msg.get('stopReason','')
        print(f\"{role} | out={usage.get('output','-')} stop={stop}\")
        for c in msg.get('content',[]):
            if c.get('type')=='text': print(f'  {c[\"text\"][:200]}')
"
```

### Rodar testes do claw-kb
```bash
cd ~/.openclaw/workspace/claw-kb
rm -f content.db src/.scout-state.json src/.rec-flow-state.json
node --experimental-strip-types test.ts
```

### Seed de fontes
```bash
cd ~/.openclaw/workspace/claw-kb
node --experimental-strip-types seed.ts
```

## Known Issues
- Gemini Flash Lite pode retornar `output: 0, content: []` em certos contextos — configurar `maxTokens: 8192` no modelo ajuda
- Sempre limpar sessoes apos mudancas em skills ou AGENTS.md
- `tools.elevated.allowFrom.telegram` deve ser `["direct"]` (array, NAO boolean)
- Resetar `usageStats` em auth-profiles.json apos mudancas de auth
- Contexto antigo com erros envenena o modelo — sempre deletar sessao antes de testar

## Documentacao oficial do OpenClaw
- Index: https://docs.openclaw.ai/llms.txt
- Skills: https://docs.openclaw.ai/tools/skills.md
- Creating skills: https://docs.openclaw.ai/tools/creating-skills.md
- Agent loop: https://docs.openclaw.ai/concepts/agent-loop.md
- System prompt: https://docs.openclaw.ai/concepts/system-prompt.md
- Streaming: https://docs.openclaw.ai/concepts/streaming.md
- Google provider: https://docs.openclaw.ai/providers/google.md
- Config reference: https://docs.openclaw.ai/gateway/configuration-reference.md

## Repo Git
`github.com/<your-github-user>/openclaw` — branch main
Contem: claw-kb/, skills/, docs/
