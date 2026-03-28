# Ajustes de Skills — OpenClaw Content Intelligence

> Documento consolidado com todos os problemas identificados e correções necessárias
> para garantir o funcionamento correto das skills no Gemini 2.5 Flash Lite.
> Data: 2026-03-28

---

## Contexto

O agente (Gemini 2.5 Flash Lite) no OpenClaw via Telegram apresenta 3 problemas recorrentes:

1. **Não lê o SKILL.md** — faz web_fetch direto sem seguir a estrutura da skill
2. **Lê o SKILL.md mas usa path errado** — tenta `/usr/lib/node_modules/openclaw/skills/...` ao invés do path correto `~/.openclaw/workspace/skills/...` que está no `<available_skills>` do system prompt
3. **Lê o SKILL.md mas trava** — recebe o conteúdo (ex: 9KB do summarizer) e retorna 0 tokens

---

## Diagnóstico por skill

### content-summarizer (CRÍTICO)

**Problema principal:** SKILL.md com 8.961 bytes (~150 linhas). Quando o modelo lê, recebe ~2.500 tokens de instrução de uma vez e retorna 0 tokens (trava).

**Evidência:** Sessão b94f4e7e (18:08) — model fez `read SKILL.md`, recebeu resultado, respondeu com `outputTokens: 0, stopReason: stop`.

**Problemas secundários (boas práticas do skill-creator):**
- Description sem negative boundaries
- Sem trigger phrases explícitas no formato correto
- Zero exemplos concretos de input/output
- Linguagem vaga: "se relevante", "se aplicável", "quando faz sentido"
- Tabela markdown (Telegram não renderiza)
- Sem evals/evals.json

### content-scout (RESOLVIDO COM STATE MACHINE)

**Problema:** Fluxo de 10+ passos (read skill → exec source list → read scoring → web_fetch → exec article add → ...). Modelo emitia `<final>` após 2-3 tool calls.

**Solução implementada:** State machine no CLI (`claw-kb scout start/feed/score/skip`). Cada comando retorna `done: false` + `next_action` até terminar. SKILL.md reduzido para 1.867 bytes. Pronto para deploy.

### content-advisor (PENDENTE TESTE)

**Tamanho:** 2.850 bytes — adequado.
**Risco:** Fluxo de 6 passos com múltiplos `exec`. Mesmo risco de `<final>` prematuro do scout. Pode precisar de state machine também, mas é mais simples (só exec, sem web_fetch).

### content-recommender (PRECISA STATE MACHINE)

**Tamanho:** 4.892 bytes — no limite.
**Problema:** Fluxo complexo: `exec list` → `web_fetch` artigo 1 → `web_fetch` artigo 2 → `exec update` → `exec rec add` → gerar texto NotebookLM. Mesmo padrão do scout — vai travar.
**Solução necessária:** State machine similar ao scout (`claw-kb rec-flow start/read/save`).

---

## Correções necessárias

### 1. Refatorar content-summarizer SKILL.md

**Meta: reduzir de 8.9KB para ~3KB max.**

Mover para `references/`:
- Template de output → `references/output-template.md`
- Regras de detecção de ferramenta → `references/tool-detection.md`
- Seção de integração → `references/tool-integration-template.md`
- Regras de salvamento → `references/save-rules.md`

O SKILL.md fica só com:
```
---
name: content-summarizer
description: >
  Resumir e analisar conteúdo recebido pelo usuário gerando resumo estruturado
  com insights para projetos do usuario e quotables para produção de conteúdo.
  Ativar quando o usuário enviar link, colar texto, enviar PDF, imagem, áudio,
  ou pedir 'resumo', 'resume isso', 'analisa esse artigo', 'o que tem nesse link'.
  NÃO usar para: tradução simples, busca na web, perguntas sobre código, tarefas
  que não envolvem análise de conteúdo externo.
---

# Content Summarizer

Resumir conteúdo e gerar insights acionáveis para os projetos do usuario.

## Workflow

1. Ler preferências: references/preferences.md
2. Ler projetos: references/projetos-usuario.md
3. Extrair conteúdo:
   - Link → web_fetch na URL
   - Texto colado → processar direto
   - PDF/Imagem → extrair texto via tools
4. Ler template de output: references/output-template.md
5. SE conteúdo menciona ferramenta/repo/lib → ler references/tool-detection.md
6. Gerar resumo seguindo o template
7. Salvar em ~/.openclaw/workspace/knowledge/<categoria>/<YYYY-MM-DD>-<slug>.md

## Output Format
Sempre PT-BR. Formato definido em references/output-template.md.

## Edge Cases
- Se web_fetch falhar: informar o usuário e pedir texto colado
- Se conteúdo for muito curto (< 100 palavras): resumo breve sem forçar seções
- Se conteúdo não for em PT/EN/ES: traduzir e resumir

## Examples

### Exemplo 1 (link de artigo)
Input: "resume isso: https://example.com/artigo-sobre-agents"
Output: Resumo estruturado com TL;DR, Pontos-chave, Insights, Hot take, Quotables, Ideias de conteúdo

### Exemplo 2 (ferramenta detectada)
Input: "https://github.com/user/cool-ai-tool"
Output: Mesmo resumo + seção 🔧 Integração com setup, aplicação por projeto, esforço estimado
```

### 2. Criar references/ para content-summarizer

Mover todo o conteúdo pesado para arquivos separados:

| Arquivo | Conteúdo |
|---------|----------|
| `references/output-template.md` | Template completo de saída (TL;DR, Pontos-chave, Insights, Hot take, Quotables, etc) |
| `references/tool-detection.md` | Critérios de detecção de ferramenta + template da seção de integração |
| `references/save-rules.md` | Regras de salvamento (paths, frontmatter, categorias) |
| `references/preferences.md` | Já existe |
| `references/projetos-usuario.md` | Já existe |

### 3. Deploy do scout state machine

Arquivos prontos localmente:
- `claw-kb/src/commands/scout.ts` — state machine com start/feed/score/skip/status/reset
- `claw-kb/src/index.ts` — router atualizado
- `skills/content-scout/SKILL.md` — atualizado para usar `claw-kb scout` commands

Passos:
1. Copiar `claw-kb/` completo para VPS (`~/.openclaw/tools/claw-kb/`)
2. Copiar `skills/content-scout/SKILL.md` para VPS
3. Rodar `npm install` no VPS
4. Limpar sessão (skillsSnapshot + sessionId + .jsonl)
5. Restart gateway
6. Testar via Telegram: "roda o scout P0"

### 4. Construir state machine para recommender

Mesma abordagem do scout:
- `claw-kb rec-flow start` → lista artigos analyzed, retorna primeiro pra ler
- `claw-kb rec-flow read --id N --content "..."` → recebe conteúdo lido, pede extração
- `claw-kb rec-flow save --items '[...]'` → salva e avança para próximo ou gera recomendações
- Cada resposta: `done: false` + `next_action` até terminar

### 5. Ajustar path awareness no AGENTS.md

Adicionar na seção Skills do AGENTS.md:
```
Skills customizadas estão em ~/.openclaw/workspace/skills/<nome>/SKILL.md
Consultar o bloco <available_skills> no system prompt para o path exato de cada skill.
```

Isso reforça pro modelo onde buscar os SKILL.md sem confundir com bundled skills.

### 6. Criar evals para cada skill

Seguindo boas práticas do skill-creator, criar `evals/evals.json` para:
- content-summarizer (2 evals: artigo normal + ferramenta detectada)
- content-scout (2 evals: P0 com resultados + P0 sem resultados)
- content-advisor (2 evals: com artigos + sem artigos)
- content-recommender (2 evals: com temas + sem temas)

---

## Ordem de execução

| # | Ação | Status |
|---|------|--------|
| 1 | Refatorar content-summarizer (SKILL.md + references/) | PENDENTE |
| 2 | Ajustar AGENTS.md com path awareness | PENDENTE |
| 3 | Construir state machine recommender | PENDENTE |
| 4 | Criar evals para cada skill | PENDENTE |
| 5 | Testes unitários | PENDENTE |
| 6 | Testes E2E | PENDENTE |
| 7 | Deploy completo no VPS (scout + summarizer + recommender + AGENTS.md) | PENDENTE |

---

## Padrão de comportamento do Gemini Flash Lite (referência)

Observações coletadas das sessões:

1. **Fluxos de 2 passos funcionam**: `web_fetch` → responder ✅
2. **Fluxos de 3+ passos quebram**: modelo emite `<final>` junto com tool calls, travando após 2-3 tool calls
3. **Tool results > ~5KB**: modelo consegue processar e continuar
4. **Tool results > ~9KB**: modelo trava (retorna 0 tokens)
5. **State machines no CLI resolvem multi-step**: `done: false` + `next_action` guia o modelo passo a passo
6. **NÃO mencionar `<final>` no AGENTS.md**: confunde o modelo e faz ele mudar para formato `<tool_code>` (Python nativo do Gemini)
7. **Limpar sessão após mudanças**: sempre deletar skillsSnapshot + sessionId + .jsonl + restart gateway
