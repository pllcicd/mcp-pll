# Ferramenta: read_tool_source

**Nome interno:** `read_tool_source`
**Módulo:** `McpModule` (`src/tools/read-source.tool.ts`)
**Escopos necessários:** `USO` em `read_tool_source` **e** `LEITURA` na ferramenta alvo (`tool_name`)

---

## Descrição

Lê o código-fonte `.ts` de outra ferramenta registrada em `mcp_ferramentas`, respeitando
o escopo `LEITURA` do usuário para a ferramenta **alvo** — não o escopo da própria
`read_tool_source`. Ou seja, para ler o código de `get_os`, o usuário precisa ter
`USO` em `read_tool_source` (senão a tool nem aparece no `tools/list`) e `LEITURA` em
`get_os` especificamente.

O arquivo é lido do disco, na raiz `src/tools/` do repositório (resolvida via
`SOURCE_ROOT`, ou `process.cwd()` por padrão — ver [.env.example](../../.env.example)).
Como várias ferramentas compartilham arquivo (ex.: `get_service_title` e
`get_status_title` estão em `os.tool.ts`), o retorno é o arquivo inteiro, não um
recorte da ferramenta específica.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tool_name` | string | sim | Nome interno da ferramenta cujo código-fonte será lido |

Schema Zod:
```typescript
z.object({ tool_name: z.string().min(1) })
```

---

## Retorno

```json
{
  "tool": "get_os",
  "arquivo_fonte": "os.tool.ts",
  "code": "import { z } from 'zod';\n..."
}
```

---

## Query Executada

```sql
SELECT arquivo_fonte FROM mcp_ferramentas WHERE nome = ? AND cancelado IS NULL LIMIT 1
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Sem `USO` em `read_tool_source` | Ferramenta oculta do `tools/list` / SDK rejeita a chamada |
| Sem `LEITURA` na ferramenta alvo | `Acesso negado: você não possui o escopo LEITURA para a ferramenta "<tool_name>".` |
| Ferramenta não cadastrada | `Ferramenta "<tool_name>" não encontrada no registro.` |
| `arquivo_fonte` absoluto ou com `..` (path traversal) | `Caminho de código-fonte inválido para "<tool_name>".` |
| Arquivo ausente em disco | `Arquivo de código-fonte de "<tool_name>" não encontrado em disco.` |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_tool_source",
    "arguments": { "tool_name": "get_os" }
  },
  "id": 1
}
```
