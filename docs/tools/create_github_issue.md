# Ferramenta: create_github_issue

**Nome interno:** `create_github_issue`
**Módulo:** `McpModule` (`src/tools/github.tool.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Cria uma issue em qualquer repositório da organização GitHub `pllcicd` via API REST
do GitHub. Usada principalmente pela skill de sugestão de ferramentas
([suggest-mcp-tool](../../.claude/commands/suggest-mcp-tool.md)) quando o Claude
percebe, durante uma análise, que precisaria de uma ferramenta MCP que ainda não
existe — mas serve para abrir issues em qualquer repositório da organização, não
só no `mcp-pll`.

Requer a variável de ambiente `GITHUB_TOKEN` configurada no servidor (Personal
Access Token clássico com escopo `repo`, ou fine-grained com acesso a "All
repositories" da organização e permissão "Issues: write"). Sem ela, a ferramenta
retorna erro sem tentar a chamada HTTP.

O corpo da issue recebe automaticamente um rodapé com o autor real da chamada
(`user.nome`, `user.email` e `user.profiles` do JWT autenticado) — não depende do
texto que o modelo escreveu, então sempre reflete quem de fato acionou a ferramenta.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `repo` | string | sim | `"owner/repo"` (ex.: `"pllcicd/pll-erp"`) ou só o nome dentro da organização `pllcicd` (ex.: `"mcp-pll"`) |
| `titulo` | string | sim | Título da issue |
| `corpo` | string | sim | Corpo da issue em Markdown (o autor é anexado automaticamente, não precisa incluir) |
| `labels` | string[] | não | Labels do GitHub a aplicar na issue |

Schema Zod:
```typescript
z.object({
  repo: z.string().min(1),
  titulo: z.string().min(1),
  corpo: z.string().min(1),
  labels: z.array(z.string()).optional(),
})
```

Ao usar esta ferramenta para sugerir uma nova ferramenta MCP, o `corpo` deve conter:
- Cliente/colaborador envolvido na solicitação original (se houver)
- A solicitação original do usuário
- O que foi tentado e por que não foi possível concluir
- A sugestão de ferramenta (nome, parâmetros, tabela/lógica de negócio)

---

## Retorno

```json
{
  "numero": 42,
  "url": "https://github.com/pllcicd/mcp-pll/issues/42"
}
```

---

## Chamada Executada

```
POST https://api.github.com/repos/{owner}/{repo}/issues
Authorization: Bearer {GITHUB_TOKEN}
{ "title": "...", "body": "<corpo> + rodapé de autoria", "labels": [...] }
```

---

## Erros

| Situação | Mensagem |
|---|---|
| `GITHUB_TOKEN` não configurado | `Integração com GitHub não configurada: defina GITHUB_TOKEN...` |
| Erro na API do GitHub (token inválido, repo inexistente, sem permissão, etc.) | `Erro ao criar issue no GitHub (<repo>): <mensagem da API>` |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_github_issue",
    "arguments": {
      "repo": "mcp-pll",
      "titulo": "Sugestão de ferramenta: list_perfis_colaborador",
      "corpo": "**Cliente:** Yanca\n\n**Solicitação original:** verificar se a Yanca tem acesso à ferramenta de visualização de OS.\n\n**O que foi tentado:** listar os perfis da Yanca para cruzar com os escopos de `get_os`, mas não existe ferramenta para consultar perfis de um colaborador específico por nome.\n\n**Sugestão:** ferramenta `get_colaborador_by_nome(nome)` retornando id, perfis e status.",
      "labels": ["sugestao-ferramenta"]
    }
  },
  "id": 1
}
```
