# Template NotebookLM

Gere o texto seguindo esta estrutura. O NotebookLM vai transformar em dialogo
de podcast, entao escreva de forma que flua como conversa.

## Estrutura

```
BRIEFING DIARIO DE AI — [data por extenso]

CONTEXTO: Este briefing e para <your-name>, <your-role>.
Adaptar ao perfil e projetos do usuario.

DESTAQUES DO DIA:

1. [TITULO DO TEMA]
[Contexto: o que aconteceu, quem publicou, por que importa]
[Relevancia pro usuario: como se conecta com seus projetos/experiencia]
[Dados importantes: metricas, quotes, fatos concretos]
[Pergunta provocativa: algo pra refletir]

2. [TITULO DO TEMA]
...

3. [TITULO DO TEMA SE HOUVER]
...

CONEXOES ENTRE OS TEMAS:
[Como os destaques se relacionam entre si e com os projetos do usuario]

PERGUNTA DO DIA:
[Uma pergunta que conecta tudo e incentiva reflexao]
```

## Regras

- Maximo 3 temas
- Linguagem conversacional (o NotebookLM vai transformar em dialogo)
- Sempre referenciar projetos e experiencia do usuario
- Dados concretos > opiniao vaga
- Pergunta do dia deve ser genuinamente interessante, nao retorica
- Se so tem 1 tema relevante, gerar com 1 tema. Nao inventar pra completar 3.
- Se NENHUM tema e relevante, NAO gerar texto. Informar que nao ha destaques.
