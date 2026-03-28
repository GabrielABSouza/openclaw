# Deteccao de Ferramenta e Template de Integracao

## Quando detectar ferramenta

Verificar se o conteudo referencia:
- Link para GitHub (github.com/...)
- Mencao de repositorio, biblioteca, framework, CLI, API ou ferramenta
- Palavras-chave: "open source", "repo", "library", "framework", "tool", "SDK", "API", "CLI", "package", "pip install", "npm install", "brew install", "docker", "self-hosted"
- Posts que divulgam/anunciam ferramentas

SE detectar → adicionar a secao abaixo APOS Pontos-chave e ANTES de Insights.
SE NAO detectar → gerar resumo padrao sem esta secao.

## Secao de Integracao

```
Integracao aos seus workflows

O que e: (1 frase — nome da ferramenta e o que faz)
Repo/Link: (URL direta)
Setup: (como instalar em 1-3 passos)

Como usar nos seus projetos:
- [Projeto 1] (aplicacao pratica especifica)
- [Projeto 2] (se aplicavel)
- [OpenClaw] (SEMPRE avaliar: pode virar skill, hook, cron job ou tool?)

Integracao com OpenClaw:
- (avaliar se pode virar skill, ser chamada via exec, monitorada por cron)
- (se sim: descrever caminho de integracao em 2-3 passos)
- (se nao: explicar por que e sugerir alternativa)

Esforco estimado: Rapido (< 1h) / Medio (1-4h) / Complexo (> 4h)
Prioridade sugerida: Alta / Media / Baixa
```

## Regras

- Ser brutalmente pratico — dizer exatamente o que fazer, com que comando, em qual projeto
- Se o repo tem README com instrucoes, extrair os passos de setup reais
- Se a ferramenta nao se aplica: "Sem aplicacao direta agora. Guardar como referencia."
- Estimar esforco considerando o nivel tecnico do usuario
