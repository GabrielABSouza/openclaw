---
name: content-scout
description: "Ingerir conteúdo de fontes curadas (blogs, newsletters, YouTube), aplicar scoring de relevância, e catalogar no banco via claw-kb CLI. Ativar quando um cron job pedir verificação de fontes ou quando o usuário pedir 'verifica as fontes', 'o que tem de novo', 'roda o scout', 'scout P0/P1/P2'."
---

# Content Scout — State Machine

Este scout usa comandos determinísticos. Cada comando retorna `done: false` com `next_action` até terminar. Siga EXATAMENTE o `next_action` retornado.

## Passo 1: Iniciar

```
exec: claw-kb scout start --priority P0
```

(Substitua P0 pela prioridade pedida. Sem prioridade = omita --priority.)

O retorno inclui `next_action`. Siga a instrução.

## Passo 2: Loop de fontes

Para cada fonte, o CLI vai pedir 3 ações em sequência:

### 2a. web_fetch na URL indicada pelo `next_action`

Se web_fetch falhar:
```
exec: claw-kb scout skip
```

Se retornar conteúdo, extraia itens (título + URL do artigo). Depois:

### 2b. Enviar itens extraídos

```
exec: claw-kb scout feed --source "NOME" --items '[{"title":"...","url":"..."}]'
```

O retorno indica se há itens pra scorar. Se sim, siga `next_action`.

### 2c. Scorar artigos

Avalie cada artigo com os critérios do scoring system (projeto direto +3, ferramenta integrável +2, provider relevante +2, tema publicável +2, dados concretos +1, opinião qualificada +1, tendência emergente +1, conteúdo introdutório -2, notícia requentada -3, hype sem substância -2, fora de escopo -5). Score = max(0, min(10, soma)).

Status: skipped (0-4), ingested (5-6), cataloged (7+ — inclua summary e tags).

```
exec: claw-kb scout score --items '[{"id":N,"relevance":N,"summary":"...","tags":"[\"tag1\"]","status":"..."}]'
```

O retorno indica a próxima fonte ou `done: true`.

## Regra principal

ENQUANTO `done` for `false`, continue executando o `next_action`. Só responda ao usuário quando `done: true`.
