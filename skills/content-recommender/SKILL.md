---
name: content-recommender
description: >
  Ler artigos completos dos temas selecionados pelo advisor, gerar briefings
  de conteudo com angulo original, gancho, quotes e dados prontos pra usar.
  Ativar quando cron pedir recomendacoes ou quando o usuario pedir 'gera recomendacoes',
  'o que posso postar?', 'recomendacoes', 'briefing'.
  NAO usar para: resumir um link avulso (usar content-summarizer), varrer fontes (usar content-scout).
---

# Content Recommender — State Machine

Ler artigos completos e gerar briefings acionaveis. Usa comandos deterministicos.
Cada comando retorna `done: false` com `next_action` ate terminar. Siga EXATAMENTE o `next_action`.

## Passo 1: Iniciar

```
exec: claw-kb rec-flow start
```

Se retornar `done: true` → sem artigos. Informar ao usuario e encerrar.

## Passo 2: Loop de leitura

Para cada artigo, o CLI pede 2 acoes:

### 2a. web_fetch na URL indicada

Se web_fetch falhar:
```
exec: claw-kb rec-flow skip
```

Se retornar conteudo, extrair: resumo completo, pontos-chave (JSON array), quotes com dados, ferramentas/repos mencionados.

### 2b. Enviar dados extraidos

```
exec: claw-kb rec-flow feed --id N --full-summary "..." --key-points '[...]' --quotes '[...]'
```

SE detectou ferramenta, adicionar: `--has-tool 1 --tool-name "nome" --tool-repo "url"`

O retorno indica proximo artigo ou fase de recomendacao.

## Passo 3: Gerar recomendacoes

Quando o CLI retornar `phase: "recommendation"`, agrupar artigos por tema e gerar recomendacoes.

Para cada tema:
- Titulo conciso e provocativo
- Formato: linkedin-post, twitter-thread, article, newsletter, video-short
- Gancho: 1-2 frases partindo da EXPERIENCIA DO USUARIO
- Angulo diferencial: visao original, nao repost
- Pontos-chave: 3-5 pontos conectando artigos com experiencia do usuario
- Quotes/dados: trechos exatos dos artigos

```
exec: claw-kb rec-flow rec --title "..." --theme "..." --format "..." --hook "..." --angle "..." --key-points '[...]' --quotes '[...]' --article-ids '[...]' --priority high/medium/low
```

Maximo 3 recomendacoes. Quando terminar:
```
exec: claw-kb rec-flow done
```

## Regra principal

ENQUANTO `done` for `false`, continue executando o `next_action`. So responda ao usuario quando `done: true`.

Enviar ao usuario em formato lista (sem tabelas markdown).
