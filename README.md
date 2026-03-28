# OpenClaw — Bicho Antonio Bot

Pipeline de inteligência de conteúdo para o Bicho Antonio Bot, rodando em OpenClaw na VPS Hostinger.

## Estrutura

```
docs/
├── agente/
│   └── AGENTE-BICHO-ANTONIO.md        # Configuração completa do agente na VPS
├── content-intelligence/
│   ├── PLANO-CONTENT-INTELLIGENCE.md   # Plano de produto do pipeline
│   └── ARQUITETURA-CONTENT-INTELLIGENCE.md  # Especificação técnica
├── fases/
│   ├── FASE-1-CLAW-KB-CLI.md          # Checklist: CLI TypeScript + SQLite
│   ├── FASE-2-SKILLS.md               # Checklist: Skills do OpenClaw
│   └── FASE-3-AUTOMACAO.md            # Checklist: Cron jobs
├── REFERENCIA-OPENCLAW.md             # Referência geral do OpenClaw
└── Leia-me (informações importantes).md
```

## Pipeline

```
Scout (ingere) → Advisor (filtra) → Recommender (lê + briefing) → Telegram
```

## Stack

- **Runtime:** OpenClaw + Gemini 2.5 Flash Lite
- **Banco:** SQLite via claw-kb CLI (TypeScript)
- **Canal:** Telegram (@BichoAntonioBot)
- **VPS:** Hostinger (srv1516765)
