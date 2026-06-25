# Ferramenta: get_service_title

**Nome interno:** `get_service_title`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** nenhum

---

## Descrição

Retorna o título/nome de um tipo de serviço a partir do seu ID, consultando a tabela de configuração no `grupopll_master`.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | number | sim | ID do tipo de serviço |

Schema Zod:
```typescript
z.object({ id: z.number() })
```

---

## Retorno

```json
{
  "id": 5,
  "titulo": "Manutenção Preventiva"
}
```

> O campo retornado depende da estrutura da tabela `os_tipo_servico`. A query usa `SELECT *`.

---

## Query Executada

```sql
SELECT * FROM grupopll_master.os_tipo_servico WHERE id = ?
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Tipo de serviço não encontrado | `Tipo de serviço não encontrado` |
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_service_title",
    "arguments": { "id": 5 }
  },
  "id": 1
}
```
