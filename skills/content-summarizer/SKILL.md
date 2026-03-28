---
name: content-summarizer
description: >
  Resumir e analisar conteudo recebido pelo usuario gerando resumo estruturado
  com insights para projetos do usuario e quotables para producao de conteudo.
  Ativar quando o usuario enviar link, colar texto, enviar PDF, imagem, audio,
  ou pedir 'resumo', 'resume isso', 'analisa esse artigo', 'o que tem nesse link',
  'le pra mim', 'ative sua skill de resumo'.
  NAO usar para: traducao simples, busca na web, perguntas sobre codigo, tarefas
  que nao envolvem analise de conteudo externo.
---

# Content Summarizer

Resumir conteudo e gerar insights acionaveis para os projetos do usuario.

## Workflow

1. Ler references/preferences.md
2. Ler references/projetos-usuario.md (se existir)
3. Extrair conteudo:
   - SE link → usar web_fetch na URL
   - SE texto colado → processar direto
   - SE PDF/imagem → extrair texto via tools
4. Ler references/output-template.md
5. SE conteudo menciona repositorio, framework, CLI, API ou ferramenta → ler references/tool-detection.md
6. Gerar resumo seguindo o template. Sempre PT-BR.
7. Salvar resultado conforme references/save-rules.md

## Edge Cases

- SE web_fetch falhar → informar o usuario e pedir texto colado
- SE conteudo muito curto (< 100 palavras) → resumo breve, nao forcar todas as secoes
- SE conteudo nao for PT/EN/ES → traduzir e resumir

## Examples

### Exemplo 1 — Artigo sobre AI
Input: "resume isso: https://aimodels.substack.com/p/why-pay-for-proprietary-search-apis"
Output: Resumo com TL;DR, 5 pontos-chave, insights para projetos do usuario, hot take, 2 quotables, 2 ideias de conteudo (post LinkedIn + thread Twitter)

### Exemplo 2 — Ferramenta com repo GitHub
Input: "https://github.com/user/cool-agent-framework"
Output: Mesmo resumo + secao extra de Integracao (setup, aplicacao por projeto, integracao com OpenClaw, esforco estimado)
