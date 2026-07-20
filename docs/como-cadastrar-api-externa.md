# Como cadastrar uma nova API externa

Guia autossuficiente para integrar uma nova API externa (ex.: uma API de ERP,
como a `nasajon` já integrada) a uma ferramenta MCP. Complementa
[docs/adicionar-ferramenta.md](adicionar-ferramenta.md) — leia aquele primeiro
se a ferramenta em si (código MCP, RBAC) ainda não existe; este guia foca só
na parte de "chamar uma API HTTP externa" a partir de uma ferramenta.

> Ponto central: **integrar uma API nova não dispensa o cadastro RBAC**. A
> ferramenta que consome essa API só fica acessível depois de passar pelos
> mesmos três passos de qualquer outra ferramenta —
> `admin_register_tool` → `admin_link_tool_scope` → `admin_grant_perfil_scope`
> (seção 4 abaixo). É comum esquecer isso porque a "parte difícil" (auth
> HTTP, URL) já ficou pronta e dá a impressão de que falta só publicar.

---

## 1. Reusar o serviço de autenticação existente

O projeto tem um serviço de autenticação genérico para as APIs do Grupo PLL:
`PllApiAuthService` (`src/pll-api/pll-api-auth.service.ts`). Ele não é
específico de nenhuma API — é único para todo o host `GRUPOPLL_API_URL`, e
**esse é o caso padrão**: uma nova API externa (nasajon, ou qualquer outra sob
o mesmo host do Grupo PLL) reusa `PllApiAuthService.getToken()` e o `.env`
já existente, sem criar credenciais novas. Não crie um `.env` nem um serviço
de auth novo por API — isso só se justifica na exceção abaixo.

**Exceção — API de outro provedor/host, com credenciais próprias** (situação
rara, nenhuma API integrada até hoje se encaixa aqui): crie um serviço de auth
análogo, seguindo o mesmo padrão de `pll-api-auth.service.ts`:

```typescript
// src/xxx-api/xxx-api-auth.service.ts
@Injectable()
export class XxxApiAuthService implements OnModuleInit {
  private token: string | null = null;
  private expiresAt: number | null = null;
  private apiUrl: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiUrl = this.config.getOrThrow<string>('XXX_API_URL');
    // demais credenciais via getOrThrow, análogo a GRUPOPLL_USERNAME/PASSWORD
  }

  private async authenticate(): Promise<void> {
    // POST no endpoint de login da API, extrai o token da resposta
  }

  async getToken(): Promise<string> {
    if (!this.token || !this.expiresAt || Date.now() >= this.expiresAt) {
      await this.authenticate();
    }
    return this.token!;
  }
}
```

Regras do padrão, reproduza-as:
- Token cacheado em memória (`token`/`expiresAt`), sem persistir em banco.
- `getToken()` é *lazy*: só reautentica quando não há token ou ele expirou —
  não há refresh token separado, é reautenticação simples.
- Se o token for JWT, calcule `expiresAt` decodificando o claim `exp` (com
  buffer de ~60s); senão, use um TTL padrão conservador (ex.: 23h).
- Envolva o serviço num module próprio (`XxxApiModule`) que o exporte, e
  importe esse module em `McpModule` (`src/mcp/mcp.module.ts`) para poder
  injetar `XxxApiAuthService` em `McpService`.

---

## 2. Configurar a URL/credenciais em `.env.example`

Caso padrão (API sob `GRUPOPLL_API_URL`): **nada a fazer aqui** — reuse
`GRUPOPLL_API_URL`/`GRUPOPLL_USERNAME`/`GRUPOPLL_PASSWORD` já existentes em
`.env.example`. Não crie uma env nova por API.

Só na exceção da seção 1 (host/credenciais próprias de outro provedor) é que
entra env nova, adicionada em `.env.example` (com comentário de seção) **e**
na tabela de variáveis de ambiente em [docs/index.md](index.md):

```
# ── Nome da API ──────────────────────────────────────────────────────────
XXX_API_URL=https://api.exemplo.com.br
XXX_API_USERNAME=
XXX_API_PASSWORD=
```

---

## 3. Montar a URL e a chamada HTTP no serviço consumidor

Padrão do projeto (veja `McpService.fetchCmvReport` / `cmvBaseUrl` em
`src/mcp/mcp.service.ts` como referência real): a URL base é montada em
`onModuleInit()`, seguindo `{HOST_URL}/<namespace-da-api>/<recurso>`, e a
chamada HTTP fica encapsulada num método privado que:

```typescript
// onModuleInit()
this.xxxBaseUrl = `${this.config.getOrThrow<string>('GRUPOPLL_API_URL')}/<namespace>/<recurso>`;

// método privado, injetado como callback nas tools
private async fetchXxxReport(path: string, params: Record<string, unknown>) {
  const token = await this.pllAuth.getToken(); // ou this.xxxAuth.getToken()
  const response = await axios.get(
    `${this.xxxBaseUrl}/${path}`,
    { params, headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}
```

Regras:
- **Não monte URL nem chame axios dentro do arquivo `*.tool.ts`.** A tool
  recebe só uma função helper já pronta (injetada via
  `registerXxxTools(ctx, fetchXxxFn)`), assim como `cmv.tool.ts` recebe
  `fetchCmvReport`. Isso mantém a URL/token da API externa encapsulados no
  service, fora do código de RBAC/handler da ferramenta.
- Token sempre via `authService.getToken()` — nunca cacheie/repita lógica de
  auth dentro da tool.
- Se a integração exigir cache local ou log de chamadas em tabela MySQL
  própria, isso é *schema* e precisa de migration — ver
  [migrations/README.md](../migrations/README.md) e a seção de schema no
  `CLAUDE.md` do projeto (nunca editar só `schema.sql`, sempre criar também
  `migrations/AAAAMMDD_HHMM/schema.sql`).

---

## 4. Cadastrar a ferramenta que consome a API nas tabelas RBAC

Esta etapa é **obrigatória e independente** de a ferramenta chamar uma API
externa ou uma tabela MySQL local — o mecanismo de RBAC do projeto não sabe
nem se importa com a origem dos dados. Sem os passos abaixo, a ferramenta
existe no código mas fica invisível/inacessível a todo mundo.

Feito em runtime, via as ferramentas MCP de administração
(`src/tools/admin.tool.ts`), nunca editando as tabelas na mão:

```json
{ "name": "admin_register_tool",      "arguments": { "nome": "get_xxx_report", "arquivo_fonte": "xxx.tool.ts", "descricao": "Relatório XXX via API externa" } }
{ "name": "admin_link_tool_scope",    "arguments": { "tool_nome": "get_xxx_report", "escopo_codigo": "USO" } }
{ "name": "admin_link_tool_scope",    "arguments": { "tool_nome": "get_xxx_report", "escopo_codigo": "LEITURA" } }
{ "name": "admin_grant_perfil_scope", "arguments": { "perfil_codigo": "CRM", "tool_nome": "get_xxx_report", "escopo_codigo": "USO" } }
```

- `admin_register_tool` cadastra a ferramenta em `mcp_ferramentas`.
- `admin_link_tool_scope` vincula os escopos possíveis (`USO` obrigatório
  para execução, `LEITURA` opcional para permitir ler o código via
  `read_tool_source`) em `mcp_ferramentas_escopo`.
- `admin_grant_perfil_scope` é o passo que de fato **libera** a ferramenta
  para quem tiver aquele perfil, gravando em `mcp_perfis_escopo`. Sem essa
  concessão a ferramenta fica cadastrada, mas inacessível a todos.
- A concessão só passa a valer no próximo `/oauth/token` ou `/oauth/refresh`
  do colaborador (o RBAC é resolvido uma única vez nesse momento e embutido
  no JWT — ver [docs/modules/scope.md](modules/scope.md)), não
  instantaneamente para sessões já ativas.
- Ferramenta que já deve nascer disponível a um perfil (ex.: `DEVS`) sem
  chamada manual pós-deploy? Adicione ao bloco de seed em `schema.sql`
  (idempotente via `ON DUPLICATE KEY UPDATE`).

Detalhes completos de cada ferramenta admin (parâmetros, erros):
[tools/admin_register_tool.md](tools/admin_register_tool.md),
[tools/admin_link_tool_scope.md](tools/admin_link_tool_scope.md),
[tools/admin_grant_perfil_scope.md](tools/admin_grant_perfil_scope.md),
[tools/admin_revoke_perfil_scope.md](tools/admin_revoke_perfil_scope.md),
[tools/admin_list_grants.md](tools/admin_list_grants.md).

---

## 5. Documentar

- Se criou um serviço de auth novo (seção 1), crie `docs/modules/<xxx-api>.md`
  descrevendo o serviço (siga o formato de outros docs em `docs/modules/`) e
  adicione uma linha na tabela de módulos em [docs/index.md](index.md).
- Documente a(s) ferramenta(s) que consomem a API em
  `docs/tools/<nome>.md`, seguindo o template da seção 4 de
  [docs/adicionar-ferramenta.md](adicionar-ferramenta.md#4-documentar-a-ferramenta)
  — os docs `docs/tools/cmv_parts_*.md` são bons exemplos reais de ferramenta
  que consome API externa (incluem a URL do endpoint chamado).
- Adicione as ferramentas na tabela de `docs/index.md` e em
  `docs/modules/mcp.md` ("Ferramentas Implementadas").

---

## Checklist

- [ ] Confirmado: reusa `PllApiAuthService` e o `.env` existente (caso padrão) — só cria `XxxApiAuthService`/module e envs novas se for host/credenciais de outro provedor
- [ ] URL base montada em `onModuleInit()`, chamada HTTP encapsulada em método privado do service (nunca dentro do `*.tool.ts`)
- [ ] `registerXxxTool(ctx)` implementado com `authorize('<nome>')` como primeira linha, recebendo a função de fetch via parâmetro
- [ ] Chamada de registro adicionada em `src/mcp/mcp.service.ts` (`createServer`)
- [ ] Nova tabela/coluna local necessária? Migration criada em `migrations/AAAAMMDD_HHMM/schema.sql` **e** `schema.sql` atualizado
- [ ] `admin_register_tool` executado
- [ ] `admin_link_tool_scope` executado para `USO` (e `LEITURA`, se aplicável)
- [ ] `admin_grant_perfil_scope` executado para ao menos um perfil (ou incluído no seed de `schema.sql`)
- [ ] `docs/modules/<xxx-api>.md` criado (se houve novo serviço de auth) e linkado em `docs/index.md`
- [ ] `docs/tools/<nome>.md` criado e linkado em `docs/index.md`/`docs/modules/mcp.md`
