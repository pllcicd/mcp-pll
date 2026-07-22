# Ferramenta: git_referencia_salvar

**Nome interno:** `git_referencia_salvar`
**Módulo:** `McpModule` (`src/tools/git.tool.ts`)
**Escopos necessários:** `USO` em `git_referencia_salvar` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Registra que um local exato (arquivo/linhas) em um projeto git de **origem**
depende de um local exato em um projeto git de **destino** — ambos já
cadastrados em `ai_mcp.git_projetos`. Genérico, não amarrado a ferramentas
MCP: cobre tanto "código deste projeto chama endpoint de outro repositório"
quanto qualquer outra dependência projeto→projeto.

Ex.: a ferramenta `cmv_parts_rupture_analysis` (arquivo
`src/tools/cmv.tool.ts` do projeto `mcp-pll`) depende de um endpoint que vive
em `pll-api-nasajon`. O objetivo é permitir que qualquer IA lendo via MCP vá
direto ao ponto exato dos dois lados, sem precisar reexplorar nenhum dos dois
repositórios.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `projeto_id_origem` | number | sim | ID do projeto de origem (quem depende) em `ai_mcp.git_projetos` |
| `caminho_origem` | string | sim | Caminho do arquivo no projeto de origem, relativo ao root |
| `linha_inicio_origem` | number | não | Linha inicial do trecho referenciado na origem |
| `linha_fim_origem` | number | não | Linha final do trecho referenciado na origem |
| `identificador_origem` | string | não | Nome da função/ferramenta/trecho que depende do destino, ex.: `cmv_parts_rupture_analysis` |
| `projeto_id_destino` | number | sim | ID do projeto de destino (onde o código vive) em `ai_mcp.git_projetos` |
| `caminho_destino` | string | sim | Caminho do arquivo no projeto de destino, relativo ao root |
| `linha_inicio_destino` | number | não | Linha inicial do trecho referenciado no destino |
| `linha_fim_destino` | number | não | Linha final do trecho referenciado no destino |
| `identificador_destino` | string | não | Nome do endpoint/rota/função referenciado no destino, ex.: `GET /reports/cmv/parts-rupture-analysis` |
| `descricao` | string | não | Contexto: o que é e por que a origem depende do destino |

Schema Zod:
```typescript
z.object({
  projeto_id_origem: z.number().int().positive(),
  caminho_origem: z.string().min(1),
  linha_inicio_origem: z.number().int().positive().optional(),
  linha_fim_origem: z.number().int().positive().optional(),
  identificador_origem: z.string().optional(),
  projeto_id_destino: z.number().int().positive(),
  caminho_destino: z.string().min(1),
  linha_inicio_destino: z.number().int().positive().optional(),
  linha_fim_destino: z.number().int().positive().optional(),
  identificador_destino: z.string().optional(),
  descricao: z.string().optional(),
})
```

---

## Retorno

```json
{
  "id": 1,
  "fk_projeto_origem": 1,
  "caminho_origem": "src/tools/cmv.tool.ts",
  "linha_inicio_origem": 51,
  "linha_fim_origem": 63,
  "identificador_origem": "cmv_parts_rupture_analysis",
  "fk_projeto_destino": 23,
  "caminho_destino": "src/reports/reports.controller.ts",
  "linha_inicio_destino": 22,
  "linha_fim_destino": 25,
  "identificador_destino": "GET /reports/cmv/parts-rupture-analysis",
  "descricao": "Endpoint Nasajon que gera o relatório de Análise de Ruptura de Peças",
  "adicionado": "2026-07-22T14:00:00.000Z"
}
```

Se algum dos dois projetos (origem ou destino) não existir, retorna uma
mensagem de erro amigável em vez do JSON.

---

## Query Executada

```sql
INSERT INTO ai_mcp.git_referencias
  (fk_projeto_origem, caminho_origem, linha_inicio_origem, linha_fim_origem, identificador_origem,
   fk_projeto_destino, caminho_destino, linha_inicio_destino, linha_fim_destino, identificador_destino,
   descricao)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

---

## Erros

| Situação | Mensagem |
|---|---|
| Projeto(s) não encontrado(s) | `Projeto(s) não encontrado(s): <ids>.` |
| Erro de banco | Erro propagado com mensagem do MySQL |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "git_referencia_salvar",
    "arguments": {
      "projeto_id_origem": 1,
      "caminho_origem": "src/tools/cmv.tool.ts",
      "linha_inicio_origem": 51,
      "linha_fim_origem": 63,
      "identificador_origem": "cmv_parts_rupture_analysis",
      "projeto_id_destino": 23,
      "caminho_destino": "src/reports/reports.controller.ts",
      "linha_inicio_destino": 22,
      "linha_fim_destino": 25,
      "identificador_destino": "GET /reports/cmv/parts-rupture-analysis",
      "descricao": "Endpoint Nasajon que gera o relatório de Análise de Ruptura de Peças"
    }
  },
  "id": 1
}
```
