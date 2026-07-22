# Ferramenta: git_projeto_salvar

**Nome interno:** `git_projeto_salvar`
**Módulo:** `McpModule` (`src/tools/git.tool.ts`)
**Escopos necessários:** `USO` em `git_projeto_salvar` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Cadastra ou atualiza um projeto git em `ai_mcp.git_projetos`, identificado
pela URL do remote (`remote_url`). Upsert: se a `remote_url` já existir,
apenas atualiza o `nome`.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | sim | Nome amigável do projeto |
| `remote_url` | string | sim | URL do remote, ex.: `github.com/org/repo` |

Schema Zod:
```typescript
z.object({
  nome: z.string().min(1),
  remote_url: z.string().min(1),
})
```

---

## Retorno

```json
{
  "id": 1,
  "nome": "mcp-pll",
  "remote_url": "github.com/org/mcp-pll",
  "adicionado": "2026-07-22T13:00:00.000Z"
}
```

---

## Query Executada

```sql
INSERT INTO ai_mcp.git_projetos (nome, remote_url)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE nome = VALUES(nome)
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "git_projeto_salvar",
    "arguments": { "nome": "mcp-pll", "remote_url": "github.com/org/mcp-pll" }
  },
  "id": 1
}
```
