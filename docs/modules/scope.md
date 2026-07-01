# Módulo: Scope

**Localização:** `src/scope/`

Resolve os perfis de um colaborador (chaves `true` de `acesso_perfil`) para as
concessões ferramenta+escopo definidas no RBAC (`mcp_perfis_escopo` e tabelas
relacionadas — ver [modules/database.md](database.md#rbac-de-ferramentas-mcp_)).
É a ponte entre "quais perfis o colaborador tem" ([modules/colaborador.md](colaborador.md))
e "o que esses perfis autorizam" ([modules/mcp.md](mcp.md#rbac-de-ferramentas-escopos-leitura--uso)).

---

## Arquivos

### `scope.module.ts`

Importa `DatabaseModule` e exporta `ScopeService` para uso em outros módulos.
Importado por `OAuthModule` (única consumidora até o momento).

---

### `scope.service.ts` — `ScopeService`

#### `resolveGrants(perfis: string[]): Promise<ToolGrant[]>`

Recebe a lista de perfis crus do colaborador (ex.: `['ADMIN', 'CRM']`) e retorna a
lista de concessões `{ ferramenta: string; escopo: 'LEITURA' | 'USO' }[]` que esses
perfis concedem.

**Query:**
```sql
SELECT DISTINCT f.nome AS ferramenta, e.codigo AS escopo
  FROM mcp_perfis_escopo pe
  JOIN mcp_ferramentas_escopo fe ON fe.id = pe.fk_ferramenta_escopo AND fe.cancelado IS NULL
  JOIN mcp_ferramentas f         ON f.id  = fe.fk_ferramenta        AND f.cancelado  IS NULL
  JOIN mcp_escopos e             ON e.id  = fe.fk_escopo            AND e.cancelado  IS NULL
 WHERE pe.perfil_codigo IN (?, ?, ...)
   AND pe.cancelado IS NULL
```

Todos os `cancelado IS NULL` garantem que grants/vínculos/ferramentas soft-deletados
não voltem na resolução. Com `perfis = []` retorna `[]` sem consultar o banco.

Chamado **uma única vez por emissão/renovação de token** (não por chamada de
ferramenta) em `OAuthController` — ver `POST /oauth/token` e `POST /oauth/refresh`
em [modules/oauth.md](oauth.md). O resultado é embutido no claim `scope` do JWT
como pares `"<ferramenta>:<ESCOPO>"` separados por espaço, e todo o restante do
fluxo (`authorize`/`hasScope` em `McpService.createServer`) faz apenas lookup em
memória a partir do JWT — sem hit ao banco por chamada de ferramenta.

---

## Uso

```typescript
constructor(private readonly scopeService: ScopeService) {}

const grants = await this.scopeService.resolveGrants(colab.profiles);
// [{ ferramenta: 'whoami', escopo: 'USO' }, { ferramenta: 'get_os', escopo: 'LEITURA' }, ...]
```

## Ver também

- [modules/mcp.md](mcp.md#rbac-de-ferramentas-escopos-leitura--uso) — modelo RBAC completo, como `authorize`/`hasScope` consomem os grants, e as ferramentas `admin_*` que gerenciam as tabelas.
- [modules/database.md](database.md#rbac-de-ferramentas-mcp_) — DDL, colunas e triggers de versionamento das tabelas RBAC.
- [modules/colaborador.md](colaborador.md) — como os perfis crus são extraídos de `acesso_perfil`.
