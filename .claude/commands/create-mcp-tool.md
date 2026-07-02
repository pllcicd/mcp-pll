---
description: Cria uma nova ferramenta MCP no projeto — código, cadastro RBAC (mcp_ferramentas/escopo/perfil) e documentação — seguindo o padrão do repositório mcp-pll.
argument-hint: [nome_da_ferramenta] [breve descrição]
---

Você vai criar uma nova ferramenta MCP neste projeto (`mcp-pll`). Argumentos recebidos: $ARGUMENTS

Antes de escrever qualquer código, leia `docs/adicionar-ferramenta.md` — é a
referência completa do padrão (por que toda ferramenta exige escopo, o que cada
passo faz). Não repita essa explicação de volta ao usuário, apenas siga-a.

Se alguma das informações abaixo não estiver clara a partir de `$ARGUMENTS` ou da
conversa até aqui, pergunte ao usuário antes de prosseguir:
- Nome da ferramenta (snake_case, ex.: `get_cliente`)
- Descrição curta (aparece no cliente MCP)
- Parâmetros de entrada (nome, tipo Zod, obrigatoriedade, descrição)
- Query SQL ou lógica de negócio
- Em qual arquivo de `src/tools/` ela deve viver (novo arquivo, ou agrupada em um
  já existente e relacionado, ex.: junto de `os.tool.ts`)
- Quais perfis devem receber `USO`/`LEITURA` desde já (ex.: `DEVS`) — ou se a
  concessão fica para depois, feita manualmente

Depois, execute nesta ordem (cada passo depende do anterior — não pule etapas):

1. **Código** — implemente `registerXxxTool(ctx: ToolContext)` no arquivo decidido,
   seguindo exatamente o padrão de `whoami.tool.ts`/`os.tool.ts`/`cmv.tool.ts`:
   primeira linha do handler é `const deny = await authorize('<nome>'); if (deny) return deny;`;
   erros em português; retorno via `JSON.stringify(x, null, 2)`; `z.number().int().positive()`
   para IDs.
2. **Registro** — adicione a chamada `registerXxxTool(ctx)` em `src/mcp/mcp.service.ts`,
   dentro de `createServer`, junto às demais. Nenhuma lógica de escopo extra é
   necessária aqui — o `Proxy` sobre `server.tool` já cuida disso.
3. **Build** — rode `npm run build` para confirmar que compila.
4. **Cadastro RBAC** — você (Claude Code) não tem uma sessão MCP autenticada
   contra o próprio servidor `mcp-pll` para chamar as ferramentas `admin_*`
   diretamente. Em vez disso, monte os payloads JSON exatos das chamadas
   `admin_register_tool` → `admin_link_tool_scope` (para cada escopo pedido) →
   `admin_grant_perfil_scope` (para cada perfil pedido), na ordem correta, e
   entregue-os ao usuário para executar através de um cliente MCP autenticado
   (ex.: Claude Desktop conectado ao servidor implantado, ou uma chamada HTTP
   `tools/call` direta). **Nunca** sugira editar `mcp_ferramentas`/`mcp_escopos`/
   `mcp_ferramentas_escopo`/`mcp_perfis_escopo` via SQL manual — isso pula o
   versionamento (`fk_colaborador`, tabelas `_log`).
5. **Documentação da ferramenta** — crie `docs/tools/<nome>.md` seguindo o
   template usado em `docs/tools/get_os.md` / `docs/tools/admin_register_tool.md`.
6. **Índices** — adicione uma linha na tabela de ferramentas em `docs/index.md`
   e em `docs/modules/mcp.md` (seção "Ferramentas Implementadas").

Ao final, resuma o que foi feito automaticamente (código, build, docs) e o que o
usuário ainda precisa executar manualmente (os payloads do passo 4).
