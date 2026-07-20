# Ferramenta: cmv_parts_consumption_physical_match

**Nome interno:** `cmv_parts_consumption_physical_match`
**Título de exibição:** `Relatório: Consumo de Peças Casadas Fisicamente`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Gera o relatório de **Consumo de Peças Casadas Fisicamente** (CMV) na API do Grupo PLL e retorna um link de download `.xlsx` válido por tempo limitado.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `database` | string | não | Banco da empresa (padrão: `crmoema`) |
| `forceRefresh` | boolean | não | Força a regeração do relatório ignorando cache (padrão: `false`). Usar apenas se o usuário pedir explicitamente. |

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
GET https://api.grupopll.com.br/nasajon/reports/cmv/parts-consumption-physical-match?database=crmoema
Authorization: Bearer <token PLL>
```

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "cmv_parts_consumption_physical_match",
    "arguments": { "database": "crmoema" }
  },
  "id": 1
}
```
