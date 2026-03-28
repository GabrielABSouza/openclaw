# Fase 2 — Skills OpenClaw

> Status: PENDENTE
> Dependência: Fase 1 concluída
> Referência: ARQUITETURA-CONTENT-INTELLIGENCE.md (seções 3.x)

## Objetivo

Criar as 3 skills do pipeline (scout, advisor, recommender) com seus arquivos de referência, e validar o fluxo completo manualmente.

## Tasks

### Arquivos de referência (compartilhados)
- [ ] Criar `references/projetos-gabriel.md` (usado por advisor e recommender)
- [ ] Criar `references/scoring-system.md` (usado pelo scout)
- [ ] Criar `references/format-templates.md` (usado pelo recommender)
- [ ] Criar `references/notebooklm-template.md` (usado pelo recommender)
- [ ] Criar `references/sources-config.md` (documentação das fontes, usado pelo scout)

### Skill: content-scout
- [ ] Criar `/root/.openclaw/workspace/skills/content-scout/SKILL.md`
- [ ] Copiar `references/scoring-system.md` pra dentro da skill
- [ ] Copiar `references/sources-config.md` pra dentro da skill
- [ ] Testar manualmente: pedir pro bot "roda o scout P0" via Telegram
- [ ] Verificar: artigos aparecem no banco (`claw-kb article list`)
- [ ] Verificar: breakdown de scoring está salvo (`claw-kb article get --id 1`)

### Skill: content-advisor
- [ ] Criar `/root/.openclaw/workspace/skills/content-advisor/SKILL.md`
- [ ] Copiar `references/projetos-gabriel.md` pra dentro da skill
- [ ] Testar manualmente: pedir "analisa o que tem no banco" via Telegram
- [ ] Verificar: artigos marcados como "analyzed" (`claw-kb article list --status analyzed`)

### Skill: content-recommender
- [ ] Criar `/root/.openclaw/workspace/skills/content-recommender/SKILL.md`
- [ ] Copiar `references/projetos-gabriel.md`, `format-templates.md`, `notebooklm-template.md`
- [ ] Testar manualmente: pedir "gera recomendações" via Telegram
- [ ] Verificar: recomendações salvas (`claw-kb rec list`)
- [ ] Verificar: texto NotebookLM enviado no Telegram
- [ ] Verificar: briefing expandido funciona ao responder com número

### Teste end-to-end manual
- [ ] Executar sequência completa: scout P1 → advisor → recommender
- [ ] Validar dados no banco em cada etapa
- [ ] Validar output no Telegram
- [ ] Ajustar prompts das skills se necessário

## Critério de conclusão

Executar o pipeline manualmente via Telegram e receber:
1. Scout report com artigos catalogados
2. Recomendações com briefing expansível
3. Texto NotebookLM pronto pra colar
