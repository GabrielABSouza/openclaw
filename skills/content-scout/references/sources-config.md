# Configuracao de Fontes

Documentacao de como cadastrar e processar fontes no claw-kb.

## Prioridades e Frequencia

| Prioridade | Frequencia | Descricao |
|-----------|------------|-----------|
| P0 | Diario | Fontes criticas que voce quer acompanhar todo dia |
| P1 | 3x/semana | Fontes importantes mas que nao precisam de check diario |
| P2 | Semanal | Newsletters, digests, fontes de volume alto |

## Como adicionar fontes

Via CLI:
```bash
claw-kb source add --name "nome-da-fonte" --type rss --url "https://..." --priority P0 --frequency daily
```

Ou editando `claw-kb/seed.ts` e rodando:
```bash
node --experimental-strip-types seed.ts
```

## Tipos de fonte e como o scout processa cada um

### RSS (`type: rss`)
- Fazer `web_fetch` na URL do feed
- Parsear itens: titulo, link, description/summary, pubDate
- Cada item vira um artigo potencial

### Blog (`type: blog`)
- Fazer `web_fetch` na URL do blog
- Extrair da pagina: lista de posts recentes com titulo, URL, excerpt
- Navegar apenas a pagina principal, nao seguir links

### Newsletter (`type: newsletter`)
- Pode nao ter URL (alimentada manualmente via Telegram)
- Se tiver URL (ex: Substack), fazer `web_fetch` e extrair posts recentes
- Se nao tiver URL, o scout ignora (fonte alimentada manualmente)

### YouTube (`type: youtube`)
- Fazer `web_fetch` na URL do canal/playlist
- Extrair: titulo do video, URL, descricao curta
- content-type sera `video`

## Exemplos de fontes por area

### AI / Machine Learning
```bash
claw-kb source add --name "anthropic-blog" --type blog --url "https://www.anthropic.com/news" --priority P0 --frequency daily
claw-kb source add --name "openai-blog" --type rss --url "https://openai.com/blog/rss.xml" --priority P0 --frequency daily
claw-kb source add --name "huggingface-blog" --type blog --url "https://huggingface.co/blog" --priority P1 --frequency "3x-week"
claw-kb source add --name "arxiv-cs-ai" --type rss --url "https://rss.arxiv.org/rss/cs.AI" --priority P2 --frequency weekly
```

### Tech / Startups
```bash
claw-kb source add --name "techcrunch-ai" --type rss --url "https://techcrunch.com/category/artificial-intelligence/feed/" --priority P0 --frequency daily
claw-kb source add --name "hacker-news" --type rss --url "https://news.ycombinator.com/rss" --priority P1 --frequency "3x-week"
```

### Newsletters
```bash
claw-kb source add --name "the-batch" --type newsletter --url "https://www.deeplearning.ai/the-batch/" --priority P2 --frequency weekly
claw-kb source add --name "import-ai" --type rss --url "https://importai.substack.com/feed" --priority P2 --frequency weekly
```

## Gerenciar fontes

```bash
claw-kb source list                    # listar todas
claw-kb source check --id N            # verificar status
claw-kb source enable --id N           # habilitar
claw-kb source disable --id N          # desabilitar
```
