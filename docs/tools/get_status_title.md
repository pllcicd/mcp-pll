# Ferramenta: get_status_title

**Nome interno:** `get_status_title`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** nenhum

---

## Descrição

Retorna o título/nome de um status de setor a partir do seu ID, consultando a tabela de configuração no `grupopll_master`.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | number | sim | ID do status |

Schema Zod:
```typescript
z.object({ id: z.number() })
```

---

## Retorno

```json
{
  "id": 3,
  "titulo": "Em Andamento"
}
```

> O campo retornado depende da estrutura da tabela `setor_status`. A query usa `SELECT *`.

---

## Query Executada

```sql
SELECT * FROM grupopll_master.setor_status WHERE id = ?
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Status não encontrado | `Status não encontrado` |
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_status_title",
    "arguments": { "id": 3 }
  },
  "id": 1
}
```
