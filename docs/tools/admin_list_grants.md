# Ferramenta: admin_list_grants

**Nome interno:** `admin_list_grants`
**Módulo:** `McpModule` (`src/tools/admin.tool.ts`)
**Escopos necessários:** `USO` em `admin_list_grants` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Lista as concessões RBAC atuais (`mcp_perfis_escopo`), opcionalmente filtrando por
um perfil específico. Ferramenta de leitura/inspeção — útil para auditar quem tem
acesso a quê antes de conceder ou revogar algo.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `perfil_codigo` | string | não | Filtra por um código de perfil específico; omitido lista todas as concessões |

Schema Zod:
```typescript
z.object({ perfil_codigo: z.string().optional() })
```

---

## Retorno

```json
[
  { "perfil_codigo": "ADMIN", "ferramenta": "whoami", "escopo": "LEITURA", "adicionado": "2026-06-30T12:00:00.000Z" },
  { "perfil_codigo": "ADMIN", "ferramenta": "whoami", "escopo": "USO", "adicionado": "2026-06-30T12:00:00.000Z" },
  { "perfil_codigo": "CRM", "ferramenta": "get_cliente", "escopo": "USO", "adicionado": "2026-07-01T09:30:00.000Z" }
]
```

Apenas concessões ativas (`cancelado IS NULL`) aparecem.

---

## Query Executada

```sql
SELECT pe.perfil_codigo, f.nome AS ferramenta, e.codigo AS escopo, pe.adicionado
  FROM mcp_perfis_escopo pe
  JOIN mcp_ferramentas_escopo fe ON fe.id = pe.fk_ferramenta_escopo
  JOIN mcp_ferramentas f         ON f.id  = fe.fk_ferramenta
  JOIN mcp_escopos e             ON e.id  = fe.fk_escopo
 WHERE pe.cancelado IS NULL
   [AND pe.perfil_codigo = ?]
 ORDER BY pe.perfil_codigo, f.nome, e.codigo
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Sem escopo `USO` | Ferramenta oculta do `tools/list` / SDK rejeita a chamada |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "admin_list_grants",
    "arguments": { "perfil_codigo": "ADMIN" }
  },
  "id": 1
}
```

## Ver também

[docs/adicionar-ferramenta.md](../adicionar-ferramenta.md) — passo a passo completo para adicionar uma nova ferramenta ao projeto.
