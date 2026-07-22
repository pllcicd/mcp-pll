# Ferramenta: git_projeto_listar

**Nome interno:** `git_projeto_listar`
**Módulo:** `McpModule` (`src/tools/git.tool.ts`)
**Escopos necessários:** `USO` em `git_projeto_listar` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Lista todos os projetos git cadastrados em `ai_mcp.git_projetos`, ordenados
por nome.

---

## Parâmetros de Entrada

Nenhum.

---

## Retorno

```json
[
  {
    "id": 1,
    "nome": "mcp-pll",
    "remote_url": "github.com/org/mcp-pll",
    "adicionado": "2026-07-22T13:00:00.000Z"
  }
]
```

---

## Query Executada

```sql
SELECT * FROM ai_mcp.git_projetos ORDER BY nome
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "git_projeto_listar",
    "arguments": {}
  },
  "id": 1
}
```
