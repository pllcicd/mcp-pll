# Ferramenta: list_colaboradores

**Nome interno:** `list_colaboradores`
**Módulo:** `McpModule` (`src/tools/colaborador.tool.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Lista colaboradores cadastrados em `grupopll_master.cadastro_colaborador`, com o
campo `acesso_perfil` normalizado em um array de strings (`perfis`) — a coluna no
banco pode conter tanto uma string JSON quanto um objeto JSON (ex.:
`{"ADMIN": true}`); ambos os formatos são tratados. Também retorna a coluna
`cancelado`, para indicar se o colaborador está desativado (`cancelado` não nulo)
ou ativo (`cancelado` nulo). Aceita um filtro opcional de busca por nome ou email.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `busca` | string | não | Filtro por nome ou email (busca parcial, `LIKE` aplicado em ambas as colunas). Se omitido, lista todos os colaboradores. |

Schema Zod:
```typescript
z.object({
  busca: z.string().trim().min(1).optional(),
})
```

---

## Retorno

Array de colaboradores, cada um com o `acesso_perfil` já normalizado em `perfis`:

```json
[
  {
    "id": 12,
    "nome": "Maria Silva",
    "email": "maria.silva@grupopll.com.br",
    "perfis": ["ADMIN", "CRM"],
    "cancelado": null
  },
  {
    "id": 34,
    "nome": "João Souza",
    "email": "joao.souza@grupopll.com.br",
    "perfis": [],
    "cancelado": "2025-11-03T13:20:00.000Z"
  }
]
```

- `perfis` contém apenas as chaves de `acesso_perfil` cujo valor é `true`. Se
  `acesso_perfil` for nulo ou malformado, `perfis` é retornado como `[]`.
- `cancelado` é `null` para colaboradores ativos, ou o timestamp do cancelamento
  (soft-delete) caso contrário.

---

## Query Executada

```sql
SELECT id, nome, email, acesso_perfil, cancelado
  FROM grupopll_master.cadastro_colaborador
  [WHERE nome LIKE ? OR email LIKE ?]   -- apenas se `busca` for informado
 ORDER BY nome
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Sem escopo `USO` | Erro padrão de autorização (`authorize`) |
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

Listar todos:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_colaboradores",
    "arguments": {}
  },
  "id": 1
}
```

Filtrando por nome ou email:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_colaboradores",
    "arguments": { "busca": "maria" }
  },
  "id": 2
}
```
