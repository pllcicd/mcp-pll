# Ferramenta: admin_revoke_perfil_scope

**Nome interno:** `admin_revoke_perfil_scope`
**Módulo:** `McpModule` (`src/tools/admin.tool.ts`)
**Escopos necessários:** `USO` em `admin_revoke_perfil_scope` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Revoga (soft-delete) o escopo (`LEITURA` ou `USO`) de uma ferramenta concedido a um
perfil — o inverso de `admin_grant_perfil_scope`. Marca `cancelado = NOW()` na
linha correspondente de `mcp_perfis_escopo`; não apaga a linha (histórico
preservado em `mcp_perfis_escopo_log`).

A revogação só passa a valer no próximo `/oauth/token`/`/oauth/refresh` do
colaborador (ver [modules/scope.md](../modules/scope.md)) — não corta sessões
já ativas.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `perfil_codigo` | string | sim | Código do perfil |
| `tool_nome` | string | sim | Nome da ferramenta |
| `escopo_codigo` | `"LEITURA"` \| `"USO"` | sim | Escopo a revogar |

Schema Zod:
```typescript
z.object({
  perfil_codigo: z.string().min(1),
  tool_nome: z.string().min(1),
  escopo_codigo: z.enum(['LEITURA', 'USO']),
})
```

---

## Retorno

```json
"Escopo \"USO\" de \"get_cliente\" revogado do perfil \"CRM\"."
```

Se não houver concessão ativa para revogar:
```json
"Nenhuma concessão ativa de \"get_cliente:USO\" para o perfil \"CRM\"."
```

---

## Query Executada

```sql
UPDATE mcp_perfis_escopo pe
  JOIN mcp_ferramentas_escopo fe ON fe.id = pe.fk_ferramenta_escopo
  JOIN mcp_ferramentas f         ON f.id  = fe.fk_ferramenta
  JOIN mcp_escopos e             ON e.id  = fe.fk_escopo
   SET pe.cancelado = NOW(), pe.fk_colaborador = ?
 WHERE pe.perfil_codigo = ? AND f.nome = ? AND e.codigo = ? AND pe.cancelado IS NULL
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Nenhuma linha afetada (já revogado ou nunca concedido) | `Nenhuma concessão ativa de "<tool_nome>:<escopo_codigo>" para o perfil "<perfil_codigo>".` |
| Sem escopo `USO` | Ferramenta oculta do `tools/list` / SDK rejeita a chamada |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "admin_revoke_perfil_scope",
    "arguments": { "perfil_codigo": "CRM", "tool_nome": "get_cliente", "escopo_codigo": "USO" }
  },
  "id": 1
}
```

## Ver também

[docs/adicionar-ferramenta.md](../adicionar-ferramenta.md) — passo a passo completo para adicionar uma nova ferramenta ao projeto.
