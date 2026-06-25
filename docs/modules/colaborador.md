# Módulo: Colaborador

**Localização:** `src/colaborador/`

Responsável por buscar dados de colaboradores do Grupo PLL no banco `grupopll_master`. Usado principalmente durante a renovação de tokens para atualizar escopos.

---

## Arquivos

### `colaborador.module.ts`

Importa `DatabaseModule` e exporta `ColaboradorService` para uso em outros módulos.

---

### `colaborador.service.ts` — `ColaboradorService`

#### `getColaborador(id: number)`

Busca um colaborador pelo ID na tabela `grupopll_master.cadastro_colaborador`.

**Query:**
```sql
SELECT id, email, nome, modulos
FROM grupopll_master.cadastro_colaborador
WHERE id = ?
LIMIT 1
```

**Retorno:**
```typescript
{
  id: number,
  email: string,
  nome: string,
  scopes: string[],   // campo `modulos` (CSV) convertido para array
}
```

O campo `modulos` é armazenado como string separada por vírgulas no banco (ex: `"crm,financeiro,rh"`) e convertido para `["crm", "financeiro", "rh"]`.

Lança `Error('Colaborador não encontrado')` se o ID não existir.

---

## Uso no Fluxo OAuth

Durante a renovação de tokens (`POST /oauth/refresh`), os escopos do colaborador podem ser re-consultados para garantir que permissões revogadas no ERP não persistam em tokens novos.

> **Nota:** A integração completa de `getColaborador` na geração do token inicial está preparada mas comentada em `oauth.controller.ts`. Atualmente os escopos são derivados do próprio payload do pll-erp.
