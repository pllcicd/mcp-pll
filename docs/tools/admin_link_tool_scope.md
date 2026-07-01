# Ferramenta: admin_link_tool_scope

**Nome interno:** `admin_link_tool_scope`
**Módulo:** `McpModule` (`src/tools/admin.tool.ts`)
**Escopos necessários:** `USO` em `admin_link_tool_scope` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Vincula um escopo (`LEITURA` ou `USO`) a uma ferramenta já cadastrada
(`mcp_ferramentas_escopo`). É o segundo passo do cadastro de uma ferramenta: sem
esse vínculo, não há o que `admin_grant_perfil_scope` conceder a um perfil — a
tabela de grants referencia o **vínculo** ferramenta+escopo, não a ferramenta ou o
escopo isoladamente.

Upsert: se o vínculo já existir, apenas atualiza `fk_colaborador` e limpa
`cancelado` (undelete). Grava `fk_colaborador = <usuário autenticado>`.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tool_nome` | string | sim | Nome da ferramenta (deve existir em `mcp_ferramentas`) |
| `escopo_codigo` | `"LEITURA"` \| `"USO"` | sim | Código do escopo a vincular |

Schema Zod:
```typescript
z.object({
  tool_nome: z.string().min(1),
  escopo_codigo: z.enum(['LEITURA', 'USO']),
})
```

---

## Retorno

```json
"Escopo \"USO\" vinculado à ferramenta \"get_cliente\"."
```

Se a ferramenta ou o escopo não existirem:
```json
"Ferramenta \"get_cliente\" ou escopo \"USO\" não encontrado."
```

---

## Query Executada

```sql
SELECT id FROM mcp_ferramentas WHERE nome = ? AND cancelado IS NULL LIMIT 1;
SELECT id FROM mcp_escopos WHERE codigo = ? AND cancelado IS NULL LIMIT 1;

INSERT INTO mcp_ferramentas_escopo (fk_ferramenta, fk_escopo, fk_colaborador)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE fk_colaborador = VALUES(fk_colaborador), cancelado = NULL
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Ferramenta ou escopo inexistente | `Ferramenta "<tool_nome>" ou escopo "<escopo_codigo>" não encontrado.` |
| Sem escopo `USO` | Ferramenta oculta do `tools/list` / SDK rejeita a chamada |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "admin_link_tool_scope",
    "arguments": { "tool_nome": "get_cliente", "escopo_codigo": "USO" }
  },
  "id": 1
}
```

## Ver também

[docs/adicionar-ferramenta.md](../adicionar-ferramenta.md) — passo a passo completo para adicionar uma nova ferramenta ao projeto.
