# Ferramenta: view_schema

**Nome interno:** `view_schema`
**Módulo:** `McpModule` (`src/tools/schema.tool.ts`)
**Escopos necessários:** `USO` em `view_schema` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Retorna o schema (colunas, tipos, nulabilidade, chaves, valor padrão e extras) de
qualquer tabela do banco de dados, consultando `information_schema.columns`.
Permite inspecionar a estrutura de qualquer tabela informando `banco.tabela`
(ex.: `grupopll_crmoema.os`).

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tabela` | string | sim | Nome completo da tabela no formato `banco.tabela`, ex.: `grupopll_crmoema.os` |

Schema Zod:
```typescript
z.object({
  tabela: z.string().regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/),
})
```

---

## Retorno

Lista de colunas da tabela, uma por linha, na ordem física (`ORDINAL_POSITION`).

```json
[
  {
    "coluna": "id",
    "tipo": "int(11)",
    "aceita_nulo": "NO",
    "chave": "PRI",
    "valor_padrao": null,
    "extra": "auto_increment"
  },
  "..."
]
```

---

## Query Executada

```sql
SELECT
  COLUMN_NAME AS coluna,
  COLUMN_TYPE AS tipo,
  IS_NULLABLE AS aceita_nulo,
  COLUMN_KEY AS chave,
  COLUMN_DEFAULT AS valor_padrao,
  EXTRA AS extra
FROM information_schema.columns
WHERE table_schema = ? AND table_name = ?
ORDER BY ORDINAL_POSITION
```

---

## Erros

| Situação | Mensagem |
|---|---|
| `tabela` fora do formato `banco.tabela` | Erro de validação Zod: `Formato esperado: "banco.tabela", ex.: grupopll_crmoema.os` |
| Tabela não encontrada (banco ou tabela inexistentes, ou usuário sem permissão de leitura no MySQL) | `Tabela "<tabela>" não encontrada.` |
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "view_schema",
    "arguments": { "tabela": "grupopll_crmoema.os" }
  },
  "id": 1
}
```
