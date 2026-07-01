# Ferramenta: whoami

**Nome interno:** `whoami`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Retorna as informações do colaborador autenticado na sessão MCP atual. Útil para confirmar qual usuário está ativo e quais permissões (escopos) foram concedidas.

---

## Parâmetros de Entrada

Nenhum.

---

## Retorno

```json
{
  "userId": "123",
  "email": "colaborador@grupopll.com.br",
  "nome": "Nome do Colaborador",
  "scopes": ["crm", "financeiro"]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `userId` | string | ID do colaborador (extraído do claim `sub` do JWT) |
| `email` | string | E-mail do colaborador |
| `nome` | string | Nome completo do colaborador |
| `scopes` | string[] | Lista de módulos/escopos concedidos |

---

## Fonte dos Dados

Os dados são lidos diretamente do objeto `user` injetado pelo `JwtAuthGuard` — ou seja, vêm dos claims do JWT, sem consulta ao banco.

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "whoami",
    "arguments": {}
  },
  "id": 1
}
```
