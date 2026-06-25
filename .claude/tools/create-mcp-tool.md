# Ferramenta: create-mcp-tool

Cria uma nova ferramenta MCP no projeto seguindo o padrão estabelecido.

## Como usar

Invoque com: `/create-mcp-tool`

Forneça as seguintes informações:
- **Nome da ferramenta** (snake_case, ex: `get_cliente`)
- **Descrição** (aparece no cliente MCP — seja claro e objetivo)
- **Parâmetros de entrada** (nome, tipo Zod, descrição)
- **Query SQL** ou lógica de negócio
- **Perfis de acesso** (quais valores de `acesso_perfil` podem usar; deixe `[]` para todos)
- **Modo de acesso** (`any` = OR, `all` = AND)

---

## Padrão do Projeto

### 1. Registrar o acesso em `src/mcp/tool-access.config.ts`

Adicione uma entrada no objeto `TOOL_ACCESS`:

```typescript
// Exemplo: apenas colaboradores com perfil 'crm' ou 'supervisor'
get_cliente: { profiles: ['crm', 'supervisor'], mode: 'any' },

// Exemplo: sem restrição
get_cliente: { profiles: [], mode: 'any' },
```

### 2. Implementar a ferramenta em `src/mcp/mcp.service.ts`

Adicione dentro do método `createServer`, antes do `return server`:

```typescript
server.tool(
  'get_cliente',
  'Retorna os dados de um cliente pelo ID',
  {
    id: z.number().int().positive().describe('ID do cliente em grupopll_master.clientes'),
  },
  async ({ id }) => {
    const deny = await authorize('get_cliente');
    if (deny) return deny;

    const [rows] = await this.pool.execute<any[]>(
      `SELECT * FROM grupopll_master.clientes WHERE id = ?`,
      [id],
    );

    if (!rows.length) {
      return { content: [{ type: 'text', text: `Cliente ${id} não encontrado.` }] };
    }

    return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
  },
);
```

### 3. Documentar em `docs/tools/<nome-da-tool>.md`

Crie o arquivo seguindo o template:

```markdown
# Ferramenta: <nome>

**Nome interno:** `<nome>`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`)
**Escopos necessários:** <perfis ou "nenhum">

## Descrição
<descrição>

## Parâmetros de Entrada
| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | number | sim | ID do recurso |

## Retorno
\`\`\`json
{ "id": 1, "campo": "valor" }
\`\`\`

## Query Executada
\`\`\`sql
SELECT * FROM schema.tabela WHERE id = ?
\`\`\`

## Erros
| Situação | Mensagem |
|---|---|
| Não encontrado | `Recurso X não encontrado.` |

## Exemplo de Uso (via MCP)
\`\`\`json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "<nome>", "arguments": { "id": 1 } },
  "id": 1
}
\`\`\`
```

---

## Checklist

- [ ] Entrada adicionada em `TOOL_ACCESS` (`tool-access.config.ts`)
- [ ] `server.tool(...)` implementado em `mcp.service.ts`
- [ ] `authorize('<nome>')` chamado como primeira linha do handler
- [ ] Retorno de "não encontrado" com mensagem clara
- [ ] Arquivo de documentação criado em `docs/tools/<nome>.md`

---

## Regras do Padrão

1. **Sempre chame `authorize` primeiro** — nunca execute lógica antes da verificação de acesso.
2. **Use `z.number().int().positive()`** para IDs, nunca `z.string()`.
3. **Retorne JSON serializado** via `JSON.stringify(row, null, 2)` — não construa strings manualmente.
4. **Mensagens de erro em português** — o usuário final é brasileiro.
5. **Nenhuma lógica no controller** — toda regra fica em `mcp.service.ts`.
6. **Sem `console.log` em produção** — remova antes de commitar.
