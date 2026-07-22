# Ferramenta: git_referencia_buscar_codigo

**Nome interno:** `git_referencia_buscar_codigo`
**Módulo:** `McpModule` (`src/tools/git.tool.ts`)
**Escopos necessários:** `USO` em `git_referencia_buscar_codigo` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Busca no GitHub (branch `main`) o **código-fonte completo** do arquivo de
destino de uma referência cruzada já cadastrada em `ai_mcp.git_referencias`.

Fecha o ciclo de análise cross-repo: ao ler o código de uma ferramenta local
(`read_tool_source`) e notar que ela depende de um endpoint/serviço de outro
projeto, use `git_referencia_listar` para localizar a referência e depois
esta ferramenta (com o `referencia_id` retornado) para ler o código real do
lado destino — sem precisar reexplorar o outro repositório manualmente.

Retorna o **arquivo inteiro**, não um recorte pelas linhas cadastradas: a
linha/identificador salvos em `git_referencias` são só uma **dica** de onde
olhar primeiro. Cortar pelo intervalo de linhas arriscaria perder a lógica
real quando ela está abstraída em outro trecho do mesmo arquivo (função
auxiliar, import, decorator, etc.).

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `referencia_id` | number | sim | ID da referência em `ai_mcp.git_referencias` (retornado por `git_referencia_listar` ou `git_referencia_salvar`) |

Schema Zod:
```typescript
z.object({
  referencia_id: z.number().int().positive(),
})
```

---

## Retorno

```json
{
  "referencia_id": 1,
  "projeto_destino": "pll-api-nasajon",
  "caminho_destino": "src/reports/reports.controller.ts",
  "branch": "main",
  "dica": {
    "linha_inicio": 22,
    "linha_fim": 25,
    "identificador": "GET /reports/cmv/parts-rupture-analysis"
  },
  "descricao": "Endpoint Nasajon que gera o relatório de Análise de Ruptura de Peças.",
  "codigo": "import { Controller, Get, Query } from '@nestjs/common';\n..."
}
```

---

## Query Executada

```sql
SELECT r.*, p.remote_url AS destino_remote_url, p.nome AS destino_nome
  FROM ai_mcp.git_referencias r
  JOIN ai_mcp.git_projetos p ON p.id = r.fk_projeto_destino
 WHERE r.id = ?
```

Seguido de uma chamada à API do GitHub:
```
GET https://api.github.com/repos/<owner>/<repo>/contents/<caminho_destino>?ref=main
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Referência não encontrada | `Referência <id> não encontrada.` |
| `GITHUB_TOKEN` não configurado | `Integração com GitHub não configurada: defina GITHUB_TOKEN (com acesso ao repositório de destino) no ambiente do servidor.` |
| Erro na API do GitHub (repo/arquivo não encontrado, sem permissão, etc.) | `Erro ao buscar código no GitHub (<repo>/<caminho>): <mensagem>` |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "git_referencia_buscar_codigo",
    "arguments": { "referencia_id": 1 }
  },
  "id": 1
}
```

## Ver também

[tools/git_referencia_listar.md](git_referencia_listar.md) — localiza o `referencia_id` a partir do projeto/ferramenta de origem.
