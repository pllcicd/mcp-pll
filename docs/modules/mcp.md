# Módulo: MCP

**Localização:** `src/mcp/`

Implementa o servidor MCP (Model Context Protocol) que expõe ferramentas para o Claude AI. Gerencia sessões HTTP, controle de acesso por escopo e auditoria de execuções.

---

## Arquivos

### `mcp.module.ts`

Importa `AuthModule` e `DatabaseModule`. Registra `McpService` e `McpController`.

---

### `mcp.service.ts` — `McpService`

Responsável por criar instâncias do servidor MCP, registrar ferramentas e controlar acesso por escopo.

#### RBAC de ferramentas: escopos LEITURA / USO

O controle de acesso não é mais um mapa estático em código — é dirigido pelo banco de
dados, com dois escopos por ferramenta:

- **`USO`** — permissão para executar a ferramenta.
- **`LEITURA`** — permissão para ver o código-fonte da ferramenta (via `read_tool_source`).

**Modelo de dados (RBAC por perfil):**

```
mcp_ferramentas          — registro de ferramentas (nome, arquivo_fonte)
mcp_escopos              — catálogo de escopos (LEITURA, USO)
mcp_ferramentas_escopo   — quais escopos cada ferramenta expõe
mcp_perfis_escopo        — concessão: perfil_codigo → ferramenta+escopo
```

Um colaborador tem N perfis (chaves com valor `true` em
`grupopll_master.cadastro_colaborador.acesso_perfil`). Cada perfil tem N concessões em
`mcp_perfis_escopo`. Todas as quatro tabelas têm as colunas `adicionado`, `cancelado`
(soft-delete) e `fk_colaborador` (quem fez a última alteração), e uma tabela `_log`
gêmea alimentada por triggers `AFTER INSERT`/`BEFORE UPDATE` para versionamento — ver
[schema.sql](../../schema.sql).

**Resolução no momento do token:** `ScopeService.resolveGrants(perfis)`
(`src/scope/scope.service.ts`) faz o JOIN das quatro tabelas e retorna a lista de
concessões `{ ferramenta, escopo }`, chamada uma única vez em `/oauth/token` e
`/oauth/refresh` (`OAuthController`). O resultado é embutido no claim `scope` do JWT
como pares `"<ferramenta>:<ESCOPO>"` separados por espaço (ex.:
`"whoami:USO get_os:LEITURA get_os:USO"`) — distinto do claim `profiles` (perfis crus).
Ver [modules/oauth.md](oauth.md) e [modules/colaborador.md](colaborador.md).

**Bootstrap:** o perfil `ADMIN` recebe `LEITURA`+`USO` em todas as ferramentas via seed
em `schema.sql`, resolvendo o problema de quem administra o próprio RBAC (as ferramentas
`admin_*` também são gate-adas por `USO`, como qualquer outra).

#### `createServer(user)`

Cria e retorna uma nova instância de `McpServer` configurada para o usuário autenticado.
As concessões do JWT (`user.grants`) são carregadas em um `Set` em memória — nenhuma
consulta ao banco por chamada de tool.

Ferramentas registradas via `server.tool(...)` passam por um `Proxy` que as desabilita
(`RegisteredTool.disable()`) imediatamente se o usuário não tiver `USO`: elas somem do
`tools/list` e o SDK rejeita qualquer chamada direta.

#### `authorize(toolName)` (closure em `ToolContext`)

Verificação em memória (sem hit ao banco) se `user.grants` contém `<toolName>:USO`.
Nega em português caso contrário. Registrada como primeira chamada em todo handler de
ferramenta (convenção mantida — ver [adicionar-ferramenta.md](../adicionar-ferramenta.md)).

#### `hasScope(ferramenta, escopo)` (closure em `ToolContext`)

Mesmo lookup em memória, mas para qualquer par ferramenta+escopo — usado por
`read_tool_source` para checar `LEITURA` da ferramenta **alvo** (não da própria tool
leitora).

#### Ferramentas de administração (`src/tools/admin.tool.ts`)

`admin_register_tool`, `admin_link_tool_scope`, `admin_grant_perfil_scope`,
`admin_revoke_perfil_scope` e `admin_list_grants` gerenciam as quatro tabelas RBAC via
ferramentas MCP (não há endpoint REST). Toda escrita grava `fk_colaborador = user.userId`,
alimentando os triggers de versionamento. Revogar é soft-delete (`cancelado = NOW()`);
re-conceder algo revogado é um "undelete" (`UPDATE ... SET cancelado = NULL`), não um
novo `INSERT`, por causa da unique key em `mcp_perfis_escopo`.

#### `logExecution(colaboradorId, toolName)`

Registra a execução de uma ferramenta na tabela `oauth_execution_log`. Operação fire-and-forget (falhas não interrompem a execução).

```sql
INSERT INTO oauth_execution_log (colaborador_id, tool_name, created_at)
VALUES (?, ?, NOW())
```

---

### Ferramentas Implementadas

Ver documentação individual em [`docs/tools/`](../tools/).

| Ferramenta | Arquivo fonte | Documentação |
|---|---|---|
| `whoami` | `src/tools/whoami.tool.ts` | [tools/whoami.md](../tools/whoami.md) |
| `get_os` | `src/tools/os.tool.ts` | [tools/get_os.md](../tools/get_os.md) |
| `get_service_title` | `src/tools/os.tool.ts` | [tools/get_service_title.md](../tools/get_service_title.md) |
| `get_status_title` | `src/tools/os.tool.ts` | [tools/get_status_title.md](../tools/get_status_title.md) |
| `list_colaboradores` | `src/tools/colaborador.tool.ts` | [tools/list_colaboradores.md](../tools/list_colaboradores.md) |
| `cmv_parts_rupture_analysis` | `src/tools/cmv.tool.ts` | [tools/cmv_parts_rupture_analysis.md](../tools/cmv_parts_rupture_analysis.md) |
| `cmv_parts_consumption_physical_match` | `src/tools/cmv.tool.ts` | [tools/cmv_parts_consumption_physical_match.md](../tools/cmv_parts_consumption_physical_match.md) |
| `cmv_parts_consumption_systemic_match` | `src/tools/cmv.tool.ts` | [tools/cmv_parts_consumption_systemic_match.md](../tools/cmv_parts_consumption_systemic_match.md) |
| `cmv_parts_consumption_awaiting_match` | `src/tools/cmv.tool.ts` | [tools/cmv_parts_consumption_awaiting_match.md](../tools/cmv_parts_consumption_awaiting_match.md) |
| `cmv_parts_operational_loss` | `src/tools/cmv.tool.ts` | [tools/cmv_parts_operational_loss.md](../tools/cmv_parts_operational_loss.md) |
| `read_tool_source` | `src/tools/read-source.tool.ts` | [tools/read_tool_source.md](../tools/read_tool_source.md) |
| `admin_register_tool` | `src/tools/admin.tool.ts` | [tools/admin_register_tool.md](../tools/admin_register_tool.md) |
| `admin_link_tool_scope` | `src/tools/admin.tool.ts` | [tools/admin_link_tool_scope.md](../tools/admin_link_tool_scope.md) |
| `admin_grant_perfil_scope` | `src/tools/admin.tool.ts` | [tools/admin_grant_perfil_scope.md](../tools/admin_grant_perfil_scope.md) |
| `admin_revoke_perfil_scope` | `src/tools/admin.tool.ts` | [tools/admin_revoke_perfil_scope.md](../tools/admin_revoke_perfil_scope.md) |
| `admin_list_grants` | `src/tools/admin.tool.ts` | [tools/admin_list_grants.md](../tools/admin_list_grants.md) |

---

### `mcp.controller.ts` — `McpController`

Expõe os endpoints HTTP do protocolo MCP. Todos os endpoints exigem JWT válido via `JwtAuthGuard`.

#### Gerenciamento de Sessões

Sessões são rastreadas pelo header `mcp-session-id`. O controller mantém um `Map<sessionId, { server, transport }>` em memória.

#### `POST /mcp`

Ponto de entrada principal para requisições MCP.

- Se não houver `mcp-session-id` ou a sessão não existir:
  1. Cria novo `McpServer` via `McpService.createServer(user)`.
  2. Cria novo `StreamableHTTPServerTransport`.
  3. Conecta server e transport.
  4. Salva a sessão no mapa.
- Se a sessão já existir: roteia a requisição para o transport existente.

#### `GET /mcp`

Recupera a resposta SSE de uma sessão existente. Requer `mcp-session-id`.

#### `DELETE /mcp`

Encerra uma sessão MCP. Remove o transport e o server do mapa de sessões.

---

## Fluxo de uma Requisição MCP

```
Claude → POST /mcp (Authorization: Bearer <jwt>, mcp-session-id: <id>)
           │
           ▼
       JwtAuthGuard valida JWT
           │
           ▼
       McpController roteia para sessão existente
       (ou cria nova sessão + servidor)
           │
           ▼
       McpServer processa a requisição (tool call)
           │
           ▼
       McpService.checkScope(user, toolName)
           │
           ▼
       Executa a ferramenta → retorna resultado
           │
           ▼
       McpService.logExecution(colaboradorId, toolName)
```
