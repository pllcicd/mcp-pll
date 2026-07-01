# Módulo: Colaborador

**Localização:** `src/colaborador/`

Responsável por buscar dados de colaboradores do Grupo PLL no banco `grupopll_master`. Usado na emissão e na renovação de tokens para resolver os perfis do usuário.

---

## Arquivos

### `colaborador.module.ts`

Importa `DatabaseModule` e exporta `ColaboradorService` para uso em outros módulos.

---

### `colaborador.service.ts` — `ColaboradorService`

#### `getColaboradorScopes(colaboradorId: number): Promise<ColaboradorInfo>`

Busca um colaborador pelo ID na tabela `grupopll_master.cadastro_colaborador`.

**Query:**
```sql
SELECT id, email, nome, acesso_perfil
  FROM grupopll_master.cadastro_colaborador
 WHERE id = ?
 LIMIT 1
```

**Retorno (`ColaboradorInfo`):**
```typescript
{
  id: number,
  email: string,
  nome: string,
  profiles: string[],   // chaves com valor true em acesso_perfil
}
```

O campo `acesso_perfil` é um JSON no banco (ex.: `{"ADMIN": true, "CONVIDADO": false}`).
Apenas as chaves com valor `true` entram em `profiles`. Cada chave é um código de
perfil (mesmo valor de `grupopll_master.cadastro_colaborador_perfil.codigo`).
JSON malformado resulta em `profiles = []` (silencioso).

Lança `Error` se o colaborador não existir.

---

## Uso no Fluxo OAuth e no RBAC de ferramentas

`getColaboradorScopes` é chamado em dois pontos de `OAuthController`
(`src/oauth/oauth.controller.ts`): na emissão inicial (`POST /oauth/token`) e na
renovação (`POST /oauth/refresh` — com fallback para os perfis armazenados no
`refresh_token` caso a consulta falhe).

Os `profiles` retornados aqui **não** são mais embutidos diretamente no JWT. Eles
alimentam `ScopeService.resolveGrants(profiles)` (`src/scope/scope.service.ts`), que
resolve as concessões ferramenta+escopo (`LEITURA`/`USO`) definidas nas tabelas RBAC
(`mcp_perfis_escopo` etc.) — ver [modules/mcp.md](mcp.md#rbac-de-ferramentas-escopos-leitura--uso).
O JWT carrega dois claims: `profiles` (perfis crus, para exibição/admin) e `scope`
(concessões resolvidas `"<ferramenta>:<ESCOPO>"`, usadas por `authorize`/`hasScope`).

Isso garante que perfis revogados no ERP deixem de conceder acesso já na próxima
renovação de token, sem exigir novo login completo.
