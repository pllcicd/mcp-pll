---
description: Detecta quando falta uma ferramenta MCP para responder a uma solicitação do usuário sobre colaboradores/acesso/ferramentas do mcp-pll, investiga com as ferramentas MCP existentes e, se a lacuna for real, abre uma issue no GitHub via create_github_issue sugerindo a nova ferramenta.
argument-hint: [contexto ou pedido do usuário a investigar]
---

TRIGGER — considere esta skill sempre que, numa sessão MCP autenticada contra o
`mcp-pll`, o usuário pedir para **verificar/analisar acesso, perfil ou permissão de
um colaborador a uma ferramenta ou funcionalidade** (ex.: "a Yanca tem acesso à
ferramenta de OS?", "quem pode ver X?", "por que fulano não consegue usar Y?"), OU
quando, no meio de qualquer outra tarefa, você perceber que precisaria de uma
ferramenta MCP que não existe no `tools/list` atual para concluir o que foi pedido.
Não é um fluxo manual de escrever SQL nem de adivinhar dados — sempre investigue via
ferramentas MCP reais antes de concluir que falta algo.

Argumento (`$ARGUMENTS`), se fornecido: contexto ou pedido específico a investigar.
Se vazio, use o pedido do usuário na conversa atual.

---

## 1. Investigar com o que já existe

Antes de assumir que falta uma ferramenta, tente resolver com as ferramentas MCP já
disponíveis nesta sessão (uso o `tools/list` real, não confie em memória — ferramentas
mudam com frequência):

- `list_colaboradores` — nome, id, email, perfis (`acesso_perfil` normalizado) e
  status (`cancelado`) de um colaborador. Use `busca` para localizar pelo nome citado.
- `admin_list_grants` — quais perfis têm `USO`/`LEITURA` em qual ferramenta.
- `view_schema` — estrutura de qualquer tabela, se precisar confirmar uma coluna.
- `read_tool_source` (exige `LEITURA` do alvo) — ver a lógica exata de uma ferramenta
  existente antes de supor o que ela faz.

Cruze os dados: perfis do colaborador (via `list_colaboradores`) × perfis com `USO`
na ferramenta em questão (via `admin_list_grants`). Responda a pergunta original com
isso sempre que possível — a maior parte das perguntas de acesso não exige nenhuma
ferramenta nova.

## 2. Reconhecer uma lacuna real

Uma lacuna real é: a pergunta do usuário exige um dado ou uma ação que nenhuma
ferramenta MCP atual expõe (ex.: perguntaram pelo colaborador antes de existir
`list_colaboradores` — não havia como resolver `nome → id/perfis` sem ela).

Não é uma lacuna real se:
- A resposta já está disponível cruzando ferramentas existentes (passo 1).
- Falta apenas um parâmetro/filtro em uma ferramenta que já existe (nesse caso, sugira
  evoluir a ferramenta existente na issue, não criar uma redundante).

## 3. Responder ao usuário primeiro

Nunca finja ter concluído a tarefa. Diga explicitamente o que não foi possível
verificar e por quê (qual ferramenta faltou), antes de abrir a issue.

## 4. Abrir a issue

Se a lacuna for real, chame `create_github_issue` (requer `USO` nessa ferramenta —
se a sessão atual não tiver, informe o usuário e pare aqui). Monte:

- **`repo`:** `mcp-pll` por padrão (a lacuna é sempre uma ferramenta deste projeto).
  Só use outro repositório da organização `pllcicd` se a lacuna for claramente sobre
  outro sistema, e nesse caso deixe explícito ao usuário qual repo você escolheu.
- **Título:** `Sugestão de ferramenta: <nome_sugerido>`
- **Corpo** (Markdown), com estas seções obrigatórias:
  1. **Cliente/colaborador** envolvido na solicitação original (nome, se houver)
  2. **Solicitação original** do usuário, como foi pedida
  3. **O que foi tentado** e o resultado da investigação do passo 1 (o que já dava
     pra responder, o que não dava)
  4. **Sugestão de ferramenta**: nome em `snake_case`, parâmetros de entrada, e a
     query/lógica de negócio proposta (referencie tabelas/colunas reais, confirmadas
     via `view_schema` quando possível — não invente nomes de coluna)
  Não é preciso incluir quem está abrindo a issue — a ferramenta já anexa
  automaticamente nome/email/perfis de quem está autenticado na sessão MCP atual.
- **Labels:** `["sugestao-ferramenta"]`

## 5. Encerrar

Informe ao usuário o número/link da issue criada, e que a implementação da
ferramenta sugerida segue o fluxo normal em
[docs/adicionar-ferramenta.md](../../docs/adicionar-ferramenta.md) (comando
`/create-mcp-tool`), a cargo do desenvolvedor que for analisar a issue.
