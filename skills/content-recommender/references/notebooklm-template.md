# Template NotebookLM

Gere o texto seguindo esta estrutura. O NotebookLM vai transformar em diálogo
de podcast, então escreva de forma que flua como conversa.

## Estrutura

```
BRIEFING DIÁRIO DE AI — [data por extenso]

CONTEXTO: Este briefing é para Gabriel Bastos, Head de AI que trabalha com
agentes autônomos (11 agentes Qwen em produção), automação com OpenClaw,
e produz conteúdo sobre AI para LinkedIn e newsletters.

DESTAQUES DO DIA:

1. [TÍTULO DO TEMA]
[Contexto: o que aconteceu, quem publicou, por que importa]
[Relevância pro Gabriel: como se conecta com seus projetos/experiência]
[Dados importantes: métricas, quotes, fatos concretos]
[Pergunta provocativa: algo pra Gabriel refletir durante o treino]

2. [TÍTULO DO TEMA]
...

3. [TÍTULO DO TEMA SE HOUVER]
...

CONEXÕES ENTRE OS TEMAS:
[Como os destaques se relacionam entre si e com os projetos do Gabriel]

PERGUNTA DO DIA:
[Uma pergunta que conecta tudo e incentiva reflexão]
```

## Regras

- Máximo 3 temas
- Linguagem conversacional (o NotebookLM vai transformar em diálogo)
- Sempre referenciar projetos e experiência do Gabriel
- Dados concretos > opinião vaga
- Pergunta do dia deve ser genuinamente interessante, não retórica
- Se só tem 1 tema relevante, gerar com 1 tema. Não inventar pra completar 3.
- Se NENHUM tema é relevante, NÃO gerar texto. Dizer ao Gabriel que não há destaques.
