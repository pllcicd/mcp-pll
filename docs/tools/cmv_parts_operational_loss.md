# Ferramenta: cmv_parts_operational_loss

**Nome interno:** `cmv_parts_operational_loss`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** nenhum

---

## Descrição

Gera o relatório de **Perda Operacional de Peças** (CMV) na API do Grupo PLL e retorna um link de download `.xlsx` válido por tempo limitado.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `database` | string | não | Banco da empresa (padrão: `crmoema`) |

---

## Retorno

```json
{
  "url": "https://<bucket>.s3.<region>.amazonaws.com/...xlsx?X-Amz-...",
  "expiresAt": "2025-06-22T15:00:00.000Z"
}
```

---

## API Externa Chamada

```
GET https://api.grupopll.com.br/nasajon/reports/cmv/parts-operational-loss?database=crmoema
Authorization: Bearer <token PLL>
```

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "cmv_parts_operational_loss",
    "arguments": { "database": "crmoema" }
  },
  "id": 1
}
```
