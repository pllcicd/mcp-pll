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

#### Mapeamento de Escopos

```typescript
const TOOL_SCOPES: Record<string, string[]> = {
  whoami: [],
  get_os: [],
  get_service_title: [],
  get_status_title: [],
};
```

Atualmente todas as ferramentas são públicas (sem escopo obrigatório). A estrutura está preparada para adicionar escopos conforme necessário.

#### `createServer(user)`

Cria e retorna uma nova instância de `McpServer` configurada para o usuário autenticado.

Registra todas as ferramentas disponíveis (ver seção [Ferramentas](#ferramentas)). Cada ferramenta verifica escopos antes de executar via `checkScope`.

#### `checkScope(user, toolName)`

Verifica se o usuário possui os escopos necessários para executar a ferramenta.

- Busca os escopos exigidos em `TOOL_SCOPES`.
- Compara com `user.scopes` (array extraído do JWT).
- Lança erro se algum escopo obrigatório estiver ausente.

#### `logExecution(colaboradorId, toolName)`

Registra a execução de uma ferramenta na tabela `oauth_execution_log`. Operação fire-and-forget (falhas não interrompem a execução).

```sql
INSERT INTO oauth_execution_log (colaborador_id, tool_name, created_at)
VALUES (?, ?, NOW())
```

---

### Ferramentas Implementadas

Ver documentação individual em [`docs/tools/`](../tools/).

| Ferramenta | Arquivo |
|---|---|
| `whoami` | [tools/whoami.md](../tools/whoami.md) |
| `get_os` | [tools/get_os.md](../tools/get_os.md) |
| `get_service_title` | [tools/get_service_title.md](../tools/get_service_title.md) |
| `get_status_title` | [tools/get_status_title.md](../tools/get_status_title.md) |

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
