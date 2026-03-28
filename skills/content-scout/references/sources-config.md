# Configuração de Fontes

Documentação das fontes cadastradas no claw-kb e como processá-las.

## Prioridades e Frequência

| Prioridade | Frequência | Cron |
|-----------|------------|------|
| P0 | Diário | Todos os dias 7h BRT |
| P1 | 3x/semana | Seg/Qua/Sex 7h30 BRT |
| P2 | Semanal | Domingo 8h BRT |

## Como processar cada tipo

### RSS (`type: rss`)
- Fazer `web_fetch` na URL do feed
- Parsear itens: título, link, description/summary, pubDate
- Cada item vira um artigo potencial

### Blog (`type: blog`)
- Fazer `web_fetch` na URL do blog
- Extrair da página: lista de posts recentes com título, URL, excerpt
- Navegar apenas a página principal, não seguir links

### Newsletter (`type: newsletter`)
- Pode não ter URL (manual via Telegram)
- Se tiver URL (ex: Substack), fazer `web_fetch` e extrair posts recentes
- Se não tiver URL, o scout ignora (fonte alimentada manualmente)

### YouTube (`type: youtube`)
- Fazer `web_fetch` na URL do canal/playlist
- Extrair: título do vídeo, URL, descrição curta
- content-type será `video`

## Fontes P0 (daily)

1. **anthropic-blog** (rss) — Blog oficial da Anthropic
2. **openai-blog** (blog) — Blog oficial da OpenAI
3. **google-ai-blog** (rss) — Blog de AI do Google
4. **huggingface-blog** (blog) — Blog do Hugging Face
5. **techcrunch-ai** (rss) — Feed de AI do TechCrunch
6. **the-verge-ai** (rss) — Feed de AI do The Verge

## Fontes P1 (3x-week)

7. **microsoft-ai-blog** (blog) — Blog de AI da Microsoft
8. **meta-ai-blog** (blog) — Blog de AI da Meta
9. **deepmind-blog** (blog) — Blog do DeepMind
10. **mit-tech-review** (rss) — MIT Technology Review
11. **ars-technica-ai** (rss) — Ars Technica Technology Lab
12. **simon-willison** (rss) — Blog do Simon Willison

## Fontes P2 (weekly)

13. **ai-news-newsletter** (newsletter) — Manual, sem URL
14. **the-batch-deeplearning** (newsletter) — The Batch do DeepLearning.ai
15. **import-ai** (newsletter) — Import AI (Substack)
16. **ben-bens-bites** (newsletter) — Ben's Bites
17. **towards-data-science** (blog) — Towards Data Science
18. **arxiv-cs-ai** (rss) — arXiv CS.AI
