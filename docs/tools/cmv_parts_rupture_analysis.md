# Ferramenta: cmv_parts_rupture_analysis

**Nome interno:** `cmv_parts_rupture_analysis`
**Título de exibição:** `Relatório: Análise de Ruptura de Peças`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Gera o relatório de **Análise de Ruptura de Peças** (CMV) na API do Grupo PLL e retorna um link de download `.xlsx` válido por tempo limitado.

O arquivo é gerado e armazenado no S3 pela API externa. Chamadas repetidas dentro do período de validade retornam o mesmo link sem novo upload.

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

| Campo | Tipo | Descrição |
|---|---|---|
| `url` | string | Link pré-assinado para download do `.xlsx` |
| `expiresAt` | string (ISO 8601) | Data/hora de expiração do link |

---

## API Externa Chamada

```
GET https://api.grupopll.com.br/nasajon/reports/cmv/parts-rupture-analysis?database=crmoema
Authorization: Bearer <token PLL>
```

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "cmv_parts_rupture_analysis",
    "arguments": { "database": "crmoema" }
  },
  "id": 1
}
```
