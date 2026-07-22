# Ferramenta: git_referencia_listar

**Nome interno:** `git_referencia_listar`
**Módulo:** `McpModule` (`src/tools/git.tool.ts`)
**Escopos necessários:** `USO` em `git_referencia_listar` (concedido por perfil em `mcp_perfis_escopo`)

---

## Descrição

Lista as referências cruzadas cadastradas em `ai_mcp.git_referencias`,
opcionalmente filtrando por projeto de origem ou de destino. Sem filtros,
retorna todas.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `projeto_id_origem` | number | não | Filtra pelo ID do projeto de origem em `ai_mcp.git_projetos` |
| `projeto_id_destino` | number | não | Filtra pelo ID do projeto de destino em `ai_mcp.git_projetos` |

Schema Zod:
```typescript
z.object({
  projeto_id_origem: z.number().int().positive().optional(),
  projeto_id_destino: z.number().int().positive().optional(),
})
```

---

## Retorno

```json
[
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
]
```

---

## Query Executada

```sql
SELECT * FROM ai_mcp.git_referencias
WHERE fk_projeto_origem = ? AND fk_projeto_destino = ?  -- condições aplicadas conforme os filtros informados
ORDER BY fk_projeto_origem, caminho_origem
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
    "name": "git_referencia_listar",
    "arguments": { "projeto_id_origem": 1 }
  },
  "id": 1
}
```
