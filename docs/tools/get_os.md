# Ferramenta: get_os

**Nome interno:** `get_os`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Busca os dados de uma Ordem de Serviço (OS) pelo seu ID no banco `grupopll_crmoema`.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | number | sim | ID da Ordem de Serviço |

Schema Zod:
```typescript
z.object({ id: z.number() })
```

---

## Retorno

Retorna os campos da OS conforme armazenados na tabela `grupopll_crmoema.os`.

```json
{
  "id": 42,
  "...": "demais campos da tabela os"
}
```

> Os campos exatos retornados dependem da estrutura da tabela `os` no banco `grupopll_crmoema`. A query usa `SELECT *`.

---

## Query Executada

```sql
SELECT * FROM grupopll_crmoema.os WHERE id = ?
```

---

## Erros

| Situação | Mensagem |
|---|---|
| OS não encontrada | `OS não encontrada` |
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_os",
    "arguments": { "id": 42 }
  },
  "id": 1
}
```
