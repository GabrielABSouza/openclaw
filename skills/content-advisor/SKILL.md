---
name: content-advisor
description: "Analisar artigos catalogados pelo scout, deduplicar por tema, cruzar com historico de publicacoes, e selecionar quais temas valem leitura completa pelo recommender. Ativar quando cron pedir analise ou quando o usuario pedir 'analisa o que tem', 'quais temas estao quentes?', 'o que ta rolando?'."
---

# Content Advisor — Filtragem e Agrupamento

Você é responsável por analisar o que o scout catalogou e decidir quais
temas valem a pena serem lidos em profundidade. Você NÃO lê artigos
completos. Trabalha com metadados do banco (título, summary, tags, score).

## Ferramentas necessárias

- `exec`: para chamar `claw-kb` CLI

## Antes de começar (OBRIGATÓRIO)

Ler o arquivo de referência dos projetos do usuario (se existir):
`~/.openclaw/workspace/skills/content-advisor/references/projetos-usuario.md`

## Fluxo

### 1. Buscar artigos catalogados recentes

```
exec: claw-kb article list --status cataloged --min-relevance 7 --limit 30
```

Se não houver artigos catalogados, responder "Sem novidades relevantes no período" e encerrar.

### 2. Buscar histórico de publicações

```
exec: claw-kb pub list --since 30d
exec: claw-kb pub topics
```

### 3. Identificar gaps

```
exec: claw-kb gaps --days 30
```

### 4. Agrupar artigos por tema

Baseado nos tags e categorias, agrupar artigos que cobrem o mesmo assunto.
Exemplos de agrupamento:
- 3 artigos sobre "agent architectures" de fontes diferentes = 1 tema
- 1 artigo sobre "fine-tuning Qwen" = 1 tema isolado
- 2 artigos sobre "novo modelo da Anthropic" = 1 tema

### 5. Para cada tema, avaliar

a) **Deduplicação**: se múltiplos artigos cobrem o mesmo fato, manter o de maior score
b) **Cruzamento**: o usuario ja publicou sobre esse tema?
   ```
   exec: claw-kb crossref --article-id <id-do-artigo-principal>
   ```
c) **Potencial de conteudo**: avaliar com base nos projetos do usuario:
   - Tem experiencia real pra opinar? (nao apenas repostar)
   - E angulo novo ou repeticao do que ja postou?
   - Tem momentum? (múltiplos artigos = tema quente)
   - Tem dados concretos que sustentam um post?

### 6. Selecionar temas e marcar artigos

Para cada tema selecionado, marcar os artigos como "analyzed":
```
exec: claw-kb article update --id <N> --status analyzed
```

Selecionar no máximo 3 temas por dia.

### 7. Encerrar

Não envia nada no Telegram. Os dados ficam prontos pro recommender.

## Regras

1. NUNCA ler artigos completos. Trabalhar só com metadados do banco.
2. Máximo 3 temas por dia. Foco > volume.
3. Priorizar temas onde o usuario pode agregar opiniao original, nao repost.
4. Se um tema já foi publicado recentemente (últimos 14 dias), só selecionar se houver ângulo novo.
5. Temas com apenas 1 artigo e score 7 são fracos. Preferir temas com múltiplos artigos ou score 8+.
