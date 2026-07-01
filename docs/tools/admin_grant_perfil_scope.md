# Ferramenta: admin_grant_perfil_scope

**Nome interno:** `admin_grant_perfil_scope`
**Módulo:** `McpModule` (`src/tools/admin.tool.ts`)
**Escopos necessários:** `USO` em `admin_grant_perfil_scope` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Concede a um perfil o escopo (`LEITURA` ou `USO`) de uma ferramenta
(`mcp_perfis_escopo`). É o passo final para que colaboradores com aquele perfil
(chave `true` em `acesso_perfil`) passem a ter a ferramenta liberada — a resolução
acontece no próximo `/oauth/token` ou `/oauth/refresh` (ver
[modules/scope.md](../modules/scope.md)), não instantaneamente em sessões já ativas.

Exige que o vínculo ferramenta+escopo já exista (`admin_link_tool_scope`). Upsert:
se a concessão já existir (mesmo revogada), apenas atualiza `fk_colaborador` e
limpa `cancelado` (undelete) — não cria uma linha duplicada.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `perfil_codigo` | string | sim | Código do perfil (mesma chave usada em `acesso_perfil`) |
| `tool_nome` | string | sim | Nome da ferramenta |
| `escopo_codigo` | `"LEITURA"` \| `"USO"` | sim | Escopo a conceder |

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
"Perfil \"CRM\" ganhou o escopo \"USO\" em \"get_cliente\"."
```

Se o vínculo ferramenta+escopo ainda não existir:
```json
"Vínculo ferramenta/escopo \"get_cliente:USO\" não encontrado — cadastre-o antes com admin_link_tool_scope."
```

---

## Query Executada

```sql
SELECT fe.id
  FROM mcp_ferramentas_escopo fe
  JOIN mcp_ferramentas f ON f.id = fe.fk_ferramenta AND f.cancelado IS NULL
  JOIN mcp_escopos e     ON e.id = fe.fk_escopo     AND e.cancelado IS NULL
 WHERE f.nome = ? AND e.codigo = ? AND fe.cancelado IS NULL
 LIMIT 1;

INSERT INTO mcp_perfis_escopo (perfil_codigo, fk_ferramenta_escopo, fk_colaborador)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE fk_colaborador = VALUES(fk_colaborador), cancelado = NULL
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Vínculo ferramenta+escopo inexistente | `Vínculo ferramenta/escopo "<tool_nome>:<escopo_codigo>" não encontrado — cadastre-o antes com admin_link_tool_scope.` |
| Sem escopo `USO` | Ferramenta oculta do `tools/list` / SDK rejeita a chamada |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "admin_grant_perfil_scope",
    "arguments": { "perfil_codigo": "CRM", "tool_nome": "get_cliente", "escopo_codigo": "USO" }
  },
  "id": 1
}
```

## Ver também

[docs/adicionar-ferramenta.md](../adicionar-ferramenta.md) — passo a passo completo para adicionar uma nova ferramenta ao projeto.
