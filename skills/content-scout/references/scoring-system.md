# Scoring System de Relevancia

Configurar abaixo o perfil do usuario para calibrar o scoring de artigos.

## Perfil do usuario
- Cargo/role: <your-role>
- Projetos ativos: (listar projetos relevantes para curadoria)
- Providers/ferramentas que usa: (ex: Anthropic/Claude, Google/Gemini)

## Criterios positivos

| Criterio | Pontos | Quando aplicar |
|----------|--------|----------------|
| Projeto direto | +3 | Titulo/excerpt menciona tema central de um dos projetos acima |
| Ferramenta integravel | +2 | Repo, CLI, API, framework que pode ser integrado a stack do usuario |
| Provider relevante | +2 | Breaking news de provider que o usuario usa ativamente |
| Tema publicavel | +2 | Assunto onde o usuario pode agregar opiniao original baseada em experiencia real |
| Dados concretos | +1 | Contem benchmarks, metricas, case studies quantitativos |
| Opiniao qualificada | +1 | Analise de alguem reconhecido, nao so noticia factual |
| Tendencia emergente | +1 | Tema apareceu em 2+ fontes nos ultimos 7 dias |

## Criterios negativos

| Criterio | Pontos | Quando aplicar |
|----------|--------|----------------|
| Conteudo introdutorio | -2 | Tutorial basico, "o que e X", conceitos que o usuario ja domina |
| Noticia requentada | -3 | Mesmo fato ja ingerido por outra fonte, sem angulo novo |
| Hype sem substancia | -2 | Buzzwords sem informacao acionavel, dados, ou insight tecnico |
| Fora de escopo | -5 | Sem relacao com as areas de interesse do usuario |

## Calculo

score = soma(positivos) + soma(negativos)
score = max(0, min(10, score))

## Breakdown JSON

Para CADA criterio, registrar:
- matched: o que matchou (ex: "projeto-x", "anthropic", true) ou null/false se nao matchou
- points: pontos atribuidos (0 se nao matchou)
