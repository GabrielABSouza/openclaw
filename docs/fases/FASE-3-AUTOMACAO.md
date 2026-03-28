# Fase 3 — Automação (Cron Jobs)

> Status: PENDENTE
> Dependência: Fase 2 concluída
> Referência: ARQUITETURA-CONTENT-INTELLIGENCE.md (seção 4)

## Objetivo

Configurar os cron jobs no OpenClaw pra que o pipeline rode automaticamente todo dia. Ajustar thresholds e frequências com base no volume real.

## Tasks

### Cron jobs
- [ ] Configurar Scout P0 — diário 7h BRT (`openclaw cron add`)
- [ ] Configurar Scout P1 — seg/qua/sex 7h30 BRT
- [ ] Configurar Scout P2 — domingo 8h BRT
- [ ] Configurar Advisor — diário 9h BRT
- [ ] Configurar Recommender — diário 10h BRT
- [ ] Configurar Digest semanal — segunda 8h BRT
- [ ] Verificar: `openclaw cron list` mostra os 6 jobs

### Validação automática
- [ ] Esperar 1 ciclo completo rodar automaticamente (manhã seguinte)
- [ ] Verificar logs: scout executou sem erro
- [ ] Verificar logs: advisor executou sem erro
- [ ] Verificar logs: recommender executou sem erro
- [ ] Verificar Telegram: recebeu scout report (se houve score 8+)
- [ ] Verificar Telegram: recebeu recomendações
- [ ] Verificar Telegram: recebeu texto NotebookLM
- [ ] Verificar banco: `claw-kb stats` mostra dados coerentes

### Ajustes
- [ ] Avaliar volume de artigos ingeridos — thresholds adequados?
- [ ] Avaliar qualidade do scoring — breakdowns fazem sentido?
- [ ] Avaliar qualidade das recomendações — briefings são acionáveis?
- [ ] Avaliar texto NotebookLM — gera bom áudio?
- [ ] Ajustar pesos do scoring se necessário
- [ ] Ajustar frequências se necessário (ex: P1 deveria ser diário?)

## Critério de conclusão

Pipeline roda 3 dias consecutivos sem intervenção manual e Gabriel recebe:
1. Scout reports relevantes
2. Recomendações com ângulos originais
3. Texto NotebookLM pronto pra podcast diário
