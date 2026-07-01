# Ferramenta: admin_register_tool

**Nome interno:** `admin_register_tool`
**Módulo:** `McpModule` (`src/tools/admin.tool.ts`)
**Escopos necessários:** `USO` em `admin_register_tool` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Cadastra ou atualiza uma ferramenta no registro RBAC (`mcp_ferramentas`). É o
primeiro passo para tornar uma nova ferramenta administrável — sem esse registro,
`admin_link_tool_scope` e `read_tool_source` não têm o que referenciar.

Upsert: se `nome` já existir, atualiza `descricao`/`arquivo_fonte` e limpa
`cancelado` (undelete). Sempre grava `fk_colaborador = <usuário autenticado>`,
alimentando o versionamento em `mcp_ferramentas_log`.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | sim | Nome interno da ferramenta (deve casar com `server.tool('<nome>', ...)`) |
| `arquivo_fonte` | string | sim | Caminho relativo a `src/tools/`, ex.: `os.tool.ts` |
| `descricao` | string | não | Descrição da ferramenta |

Schema Zod:
```typescript
z.object({
  nome: z.string().min(1),
  arquivo_fonte: z.string().min(1),
  descricao: z.string().optional(),
})
```

---

## Retorno

```json
"Ferramenta \"get_cliente\" registrada com sucesso."
```

---

## Query Executada

```sql
INSERT INTO mcp_ferramentas (nome, descricao, arquivo_fonte, fk_colaborador)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  descricao      = VALUES(descricao),
  arquivo_fonte  = VALUES(arquivo_fonte),
  fk_colaborador = VALUES(fk_colaborador),
  cancelado      = NULL
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
    "name": "admin_register_tool",
    "arguments": { "nome": "get_cliente", "arquivo_fonte": "cliente.tool.ts", "descricao": "Retorna dados de um cliente" }
  },
  "id": 1
}
```

## Ver também

[docs/adicionar-ferramenta.md](../adicionar-ferramenta.md) — passo a passo completo para adicionar uma nova ferramenta ao projeto.
