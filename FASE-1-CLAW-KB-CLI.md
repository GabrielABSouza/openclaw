# Fase 1 — claw-kb CLI

> Status: PENDENTE
> Referência: ARQUITETURA-CONTENT-INTELLIGENCE.md (seções 2.x)

## Objetivo

Criar a CLI TypeScript que serve como camada determinística entre o agente e o banco SQLite. Ao final desta fase, todos os comandos devem estar funcionando e testados na VPS.

## Tasks

### Setup
- [ ] Criar estrutura do projeto em `/root/.openclaw/tools/claw-kb/`
- [ ] Criar `package.json` com dependência `better-sqlite3`
- [ ] Instalar dependências na VPS (`npm install`)
- [ ] Criar `run.sh` e symlink `/usr/local/bin/claw-kb`
- [ ] Validar que `claw-kb stats` executa sem erro

### Core
- [ ] Implementar `src/types.ts` — interfaces e tipos
- [ ] Implementar `src/output.ts` — formatação JSON padronizada
- [ ] Implementar `src/validators.ts` — validação de inputs
- [ ] Implementar `src/db.ts` — schema, conexão, migrations (pragma user_version)

### Comandos
- [ ] `src/commands/source.ts` — add, list, check, disable, enable
- [ ] `src/commands/article.ts` — add, exists, update, list, search, stats, get
- [ ] `src/commands/rec.ts` — add, list, update, detail
- [ ] `src/commands/pub.ts` — add, list, topics
- [ ] `src/commands/analysis.ts` — crossref, gaps, digest
- [ ] `src/commands/maintenance.ts` — stats, prune, export, import

### Entry point
- [ ] `src/index.ts` — parsing de argumentos (parseArgs), roteamento de comandos

### Seed
- [ ] `seed.ts` — popular tabela sources com as 18 fontes (P0/P1/P2)

### Testes
- [ ] `test.ts` — validar happy path de todos os comandos
- [ ] `test.ts` — validar edge cases (URL duplicada, relevance inválida, JSON malformado)

### Deploy
- [ ] Copiar projeto pra VPS
- [ ] Testar todos os comandos manualmente na VPS
- [ ] Rodar seed das fontes
- [ ] Verificar: `claw-kb stats` retorna contadores corretos

## Critério de conclusão

`claw-kb stats` na VPS retorna:
```json
{
  "ok": true,
  "command": "stats",
  "data": {
    "sources": 18,
    "articles": { "total": 0 },
    "recommendations": { "total": 0 },
    "publications": { "total": 0 }
  }
}
```
