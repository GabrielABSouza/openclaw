# Regras de Salvamento

Apos gerar o resumo, salvar em:
```
~/.openclaw/workspace/knowledge/<categoria>/<YYYY-MM-DD>-<titulo-slug>.md
```

## Regras

- Categoria lowercase sem acento: ai, tech, negocios, carreira, marketing, produtividade, financas
- Titulo em kebab-case, maximo 50 caracteres
- Criar diretorio com exec se nao existir: `mkdir -p ~/.openclaw/workspace/knowledge/<categoria>`

## Frontmatter do arquivo salvo

```markdown
---
source: (URL ou "texto colado" ou "audio" ou "imagem")
date: YYYY-MM-DD
category: categoria
level: nivel
projects: [lista de projetos relacionados]
has_tool: true/false
tool_name: (nome da ferramenta, se aplicavel)
tool_repo: (URL do repo, se aplicavel)
---

(conteudo do resumo completo)
```

## Indice de ferramentas

Quando has_tool = true, salvar tambem em:
```
~/.openclaw/workspace/knowledge/tools/<YYYY-MM-DD>-<tool-name>.md
```
