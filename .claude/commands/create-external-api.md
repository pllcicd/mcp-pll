---
description: Integra uma nova API HTTP externa a uma ferramenta MCP no projeto — auth, URL, código, cadastro RBAC e documentação — seguindo o padrão do repositório mcp-pll.
argument-hint: [nome_da_api] [nome_da_ferramenta] [breve descrição]
---

Você vai integrar uma nova API HTTP externa a uma ferramenta MCP neste projeto
(`mcp-pll`). Argumentos recebidos: $ARGUMENTS

Antes de escrever qualquer código, leia
`docs/como-cadastrar-api-externa.md` (auth/URL/RBAC de APIs externas) e
`docs/adicionar-ferramenta.md` (padrão geral de ferramenta MCP e RBAC). Não
repita essas explicações de volta ao usuário, apenas siga-as.

Se alguma das informações abaixo não estiver clara a partir de `$ARGUMENTS` ou
da conversa até aqui, pergunte ao usuário antes de prosseguir:
- Nome/host da API externa e se ela já está sob `GRUPOPLL_API_URL` (mesmo host
  e credenciais do Grupo PLL) ou é um provedor/host totalmente diferente
- Endpoint(s) específico(s) a chamar (path, método, parâmetros de query/body)
- Nome da ferramenta MCP que vai expor isso (snake_case, ex.: `get_xxx_report`)
- Descrição curta (aparece no cliente MCP) e parâmetros de entrada (nome, tipo
  Zod, obrigatoriedade, descrição)
- Em qual arquivo de `src/tools/` a ferramenta deve viver (novo arquivo, ou
  agrupada em um já existente e relacionado, ex.: junto de `cmv.tool.ts`)
- Quais perfis devem receber `USO`/`LEITURA` desde já (ex.: `DEVS`) — ou se a
  concessão fica para depois, feita manualmente

**Premissa fixa, confirme antes de propor qualquer coisa diferente:** o caso
padrão é reusar `PllApiAuthService` (`src/pll-api/pll-api-auth.service.ts`) e
as envs já existentes (`GRUPOPLL_API_URL`/`GRUPOPLL_USERNAME`/`GRUPOPLL_PASSWORD`).
**Não** crie um `.env` novo nem um serviço de auth próprio por API — isso só se
justifica na exceção real de host/credenciais de outro provedor, e mesmo
assim confirme com o usuário antes.

Depois, execute nesta ordem (cada passo depende do anterior — não pule etapas):

1. **Auth** — se a API está sob `GRUPOPLL_API_URL`, não crie nada em
   `src/pll-api/`, reuse `PllApiAuthService.getToken()` diretamente. Só na
   exceção confirmada acima, crie `src/xxx-api/xxx-api-auth.service.ts` e
   `XxxApiModule`, seguindo exatamente o padrão de `pll-api-auth.service.ts`
   (token cacheado em memória, `getToken()` lazy, TTL via `exp` do JWT ou
   fallback conservador) — e adicione as envs novas em `.env.example` e na
   tabela de variáveis de ambiente em `docs/index.md`.
2. **URL e chamada HTTP** — no serviço consumidor (normalmente `McpService`),
   monte a URL base em `onModuleInit()` (`{HOST_URL}/<namespace>/<recurso>`) e
   encapsule a chamada HTTP num método privado que pega o token via
   `authService.getToken()` e chama axios com header `Authorization: Bearer`,
   seguindo exatamente o padrão de `cmvBaseUrl`/`fetchCmvReport` em
   `src/mcp/mcp.service.ts`. **Nunca** monte URL nem chame axios dentro do
   arquivo `*.tool.ts` — a tool recebe só a função de fetch já pronta, injetada
   via `registerXxxTools(ctx, fetchXxxFn)`.
3. **Código da ferramenta** — implemente `registerXxxTool(ctx: ToolContext)` no
   arquivo decidido, seguindo o padrão de `cmv.tool.ts`: primeira linha do
   handler é `const deny = await authorize('<nome>'); if (deny) return deny;`;
   erros em português; retorno via `JSON.stringify(x, null, 2)`.
4. **Registro** — adicione a chamada `registerXxxTools(ctx, fetchXxxFn)` em
   `src/mcp/mcp.service.ts`, dentro de `createServer`, junto às demais.
5. **Build** — rode `npm run build` para confirmar que compila.
6. **Migration** (só se a integração exigir nova tabela/coluna local, ex.:
   cache ou log específico) — atualize `schema.sql` **e** crie
   `migrations/AAAAMMDD_HHMM/schema.sql` com os `ALTER TABLE`/`CREATE TABLE`
   idempotentes, seguindo `migrations/README.md`. Nunca pule a migration
   mesmo para mudanças pequenas.
7. **Cadastro RBAC** — você (Claude Code) não tem uma sessão MCP autenticada
   contra o próprio servidor `mcp-pll` para chamar as ferramentas `admin_*`
   diretamente. Em vez disso, monte os payloads JSON exatos das chamadas
   `admin_register_tool` → `admin_link_tool_scope` (para cada escopo pedido) →
   `admin_grant_perfil_scope` (para cada perfil pedido), na ordem correta, e
   entregue-os ao usuário para executar através de um cliente MCP autenticado.
   **Nunca** sugira editar `mcp_ferramentas`/`mcp_escopos`/
   `mcp_ferramentas_escopo`/`mcp_perfis_escopo` via SQL manual.
8. **Documentação** — crie `docs/tools/<nome>.md` seguindo o template usado em
   `docs/tools/cmv_parts_rupture_analysis.md` (ferramenta real que consome API
   externa, inclui a URL do endpoint). Se criou um serviço de auth novo (passo
   1, exceção), crie também `docs/modules/<xxx-api>.md`.
9. **Índices** — adicione uma linha na tabela de ferramentas em `docs/index.md`
   e em `docs/modules/mcp.md` (seção "Ferramentas Implementadas"); se aplicável,
   uma linha na tabela de módulos em `docs/index.md`.

Ao final, resuma o que foi feito automaticamente (código, build, docs) e o que
o usuário ainda precisa executar manualmente (os payloads do passo 7).
