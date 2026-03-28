# Scoring System de Relevância

O Gabriel é Head de AI / AI Consultant. Ele trabalha com:
- 11 agentes Qwen em produção
- Conciliação bancária automatizada
- Programa educacional "Construa Sua Carreira"
- Marca pessoal / posicionamento como autoridade em AI
- OpenClaw como plataforma de automação

Providers que ele usa ativamente: Anthropic/Claude, Google/Gemini, Alibaba/Qwen

## Critérios positivos

| Critério | Pontos | Quando aplicar |
|----------|--------|----------------|
| Projeto direto | +3 | Título/excerpt menciona tema central de um dos projetos acima |
| Ferramenta integrável | +2 | Repo, CLI, API, framework que pode ser integrado à stack do Gabriel |
| Provider relevante | +2 | Breaking news de Anthropic, Google/Gemini, ou Alibaba/Qwen |
| Tema publicável | +2 | Assunto onde Gabriel pode agregar opinião original baseada em experiência real |
| Dados concretos | +1 | Contém benchmarks, métricas, case studies quantitativos |
| Opinião qualificada | +1 | Análise de alguém reconhecido, não só notícia factual |
| Tendência emergente | +1 | Tema apareceu em 2+ fontes nos últimos 7 dias |

## Critérios negativos

| Critério | Pontos | Quando aplicar |
|----------|--------|----------------|
| Conteúdo introdutório | -2 | Tutorial básico, "o que é X", conceitos que Gabriel já domina |
| Notícia requentada | -3 | Mesmo fato já ingerido por outra fonte, sem ângulo novo |
| Hype sem substância | -2 | Buzzwords sem informação acionável, dados, ou insight técnico |
| Fora de escopo | -5 | Sem relação com AI, tech, negócios, carreira, ou marketing |

## Cálculo

score = soma(positivos) + soma(negativos)
score = max(0, min(10, score))

## Breakdown JSON

Para CADA critério, registrar:
- matched: o que matchou (ex: "agentes-qwen", "anthropic", true) ou null/false se não matchou
- points: pontos atribuídos (0 se não matchou)
