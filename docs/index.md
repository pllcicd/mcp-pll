# MCP-PLL — Documentação Geral

Servidor MCP (Model Context Protocol) com autenticação OAuth 2.0, construído em NestJS. Permite que clientes como o Claude AI autentiquem colaboradores do Grupo PLL e executem ferramentas com controle de acesso baseado em escopos.

---

## Visão Geral da Arquitetura

```
Claude AI (cliente MCP)
        │
        │  OAuth 2.0 Authorization Code Flow
        ▼
┌─────────────────────────────────────┐
│           mcp-pll (NestJS)          │
│                                     │
│  /oauth/*    → Fluxo OAuth 2.0      │
│  /mcp        → Servidor MCP         │
│  /.well-known/* → Discovery         │
└─────────────────────────────────────┘
        │
        │  Redirect para autenticação
        ▼
┌─────────────────────────────────────┐
│           pll-erp (B2B)             │
│  Gera código HMAC-SHA256 assinado   │
└─────────────────────────────────────┘
        │
        │  Dados
        ▼
┌─────────────────────────────────────┐
│  MySQL                              │
│  grupopll_master  → colaboradores   │
│  grupopll_crmoema → ordens de serv. │
│  (banco local)    → oauth_tokens    │
└─────────────────────────────────────┘
```

---

## Fluxo OAuth 2.0 (Resumo)

1. **Authorize** — Claude chama `GET /oauth/authorize`. O servidor salva o estado do Claude e redireciona o usuário para o pll-erp.
2. **Callback** — pll-erp retorna para `GET /oauth/callback` com um código HMAC assinado. O servidor valida o HMAC e gera um `auth_code` próprio.
3. **Token** — Claude chama `POST /oauth/token` trocando o `auth_code` por um JWT de acesso (RS256) e um `refresh_token` opaco.
4. **Uso de Ferramentas** — Claude faz chamadas autenticadas a `POST /mcp` com o JWT no header `Authorization: Bearer`.
5. **Refresh** — Claude chama `POST /oauth/refresh` para renovar o JWT sem nova autenticação. O token antigo é revogado (single-rotation).

> Documentação detalhada do fluxo: [FLUXO_OAUTH.md](../FLUXO_OAUTH.md)
> Guia de integração para o pll-erp: [mcp-oauth.md](../mcp-oauth.md)

---

## Módulos

| Módulo | Responsabilidade | Documentação |
|---|---|---|
| `AuthModule` | Geração e validação de JWT RS256, gerenciamento de chaves RSA | [modules/auth.md](modules/auth.md) |
| `OAuthModule` | Fluxo OAuth 2.0 completo (authorize, callback, token, refresh) | [modules/oauth.md](modules/oauth.md) |
| `McpModule` | Servidor MCP, roteamento de sessões, execução de ferramentas | [modules/mcp.md](modules/mcp.md) |
| `ColaboradorModule` | Consulta de dados do colaborador no `grupopll_master` | [modules/colaborador.md](modules/colaborador.md) |
| `ScopeModule` | Resolve perfis → concessões ferramenta+escopo (RBAC) | [modules/scope.md](modules/scope.md) |
| `DatabaseModule` | Pool de conexões MySQL global | [modules/database.md](modules/database.md) |
| `B2BModule` | Cliente HTTP para a API B2B do pll-erp (legado) | [modules/b2b.md](modules/b2b.md) |
| `UserModule` | Autenticação por senha (legado, não usado no fluxo OAuth) | [modules/user.md](modules/user.md) |

---

## Ferramentas MCP

Todas as ferramentas exigem o escopo **USO** (execução) e, quando aplicável, **LEITURA**
(ver código-fonte). Os escopos são concedidos por perfil em `mcp_perfis_escopo` — ver
[RBAC de ferramentas](modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso).

| Ferramenta | Descrição | Documentação |
|---|---|---|
| `whoami` | Retorna informações do usuário autenticado | [tools/whoami.md](tools/whoami.md) |
| `get_os` | Busca uma Ordem de Serviço pelo ID | [tools/get_os.md](tools/get_os.md) |
| `get_service_title` | Busca o título de um tipo de serviço pelo ID | [tools/get_service_title.md](tools/get_service_title.md) |
| `get_status_title` | Busca o título de um status de setor pelo ID | [tools/get_status_title.md](tools/get_status_title.md) |
| `list_colaboradores` | Lista colaboradores e seus perfis de acesso (`acesso_perfil` normalizado em array), com filtro opcional por nome/email | [tools/list_colaboradores.md](tools/list_colaboradores.md) |
| `cmv_parts_rupture_analysis` | Relatório CMV: Análise de Ruptura de Peças | [tools/cmv_parts_rupture_analysis.md](tools/cmv_parts_rupture_analysis.md) |
| `cmv_parts_consumption_physical_match` | Relatório CMV: Consumo Casado Fisicamente | [tools/cmv_parts_consumption_physical_match.md](tools/cmv_parts_consumption_physical_match.md) |
| `cmv_parts_consumption_systemic_match` | Relatório CMV: Consumo Casado Sistemicamente | [tools/cmv_parts_consumption_systemic_match.md](tools/cmv_parts_consumption_systemic_match.md) |
| `cmv_parts_consumption_awaiting_match` | Relatório CMV: Consumo Aguardando Casamento | [tools/cmv_parts_consumption_awaiting_match.md](tools/cmv_parts_consumption_awaiting_match.md) |
| `cmv_parts_operational_loss` | Relatório CMV: Perda Operacional | [tools/cmv_parts_operational_loss.md](tools/cmv_parts_operational_loss.md) |
| `cmv_parts_stock_hit` | Relatório CMV: Estoque Disponível de Peças sem Pedido | [tools/cmv_parts_stock_hit.md](tools/cmv_parts_stock_hit.md) |
| `read_tool_source` | Lê o código-fonte `.ts` de outra ferramenta (exige LEITURA do alvo) | [tools/read_tool_source.md](tools/read_tool_source.md) |
| `view_schema` | Retorna o schema (colunas, tipos, chaves) de qualquer tabela do banco de dados | [tools/view_schema.md](tools/view_schema.md) |
| `admin_register_tool` | Cadastra/atualiza uma ferramenta no registro RBAC | [tools/admin_register_tool.md](tools/admin_register_tool.md) |
| `admin_link_tool_scope` | Vincula um escopo a uma ferramenta | [tools/admin_link_tool_scope.md](tools/admin_link_tool_scope.md) |
| `admin_grant_perfil_scope` | Concede um escopo de ferramenta a um perfil | [tools/admin_grant_perfil_scope.md](tools/admin_grant_perfil_scope.md) |
| `admin_revoke_perfil_scope` | Revoga (soft-delete) um escopo de ferramenta de um perfil | [tools/admin_revoke_perfil_scope.md](tools/admin_revoke_perfil_scope.md) |
| `admin_list_grants` | Lista as concessões RBAC atuais | [tools/admin_list_grants.md](tools/admin_list_grants.md) |
| `create_github_issue` | Cria uma issue no GitHub (ex.: sugestão de nova ferramenta) | [tools/create_github_issue.md](tools/create_github_issue.md) |

> Como adicionar uma nova ferramenta (padrão de código, cadastro nas tabelas RBAC,
> concessão de escopo): [adicionar-ferramenta.md](adicionar-ferramenta.md).

---

## Endpoints HTTP

### Discovery
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/.well-known/oauth-authorization-server` | Metadados do servidor OAuth 2.0 |
| `GET` | `/.well-known/jwks.json` | Chaves públicas para verificação de JWT |

### OAuth
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/oauth/register` | Registro dinâmico de cliente (RFC 7591) |
| `GET` | `/oauth/authorize` | Inicia o fluxo de autorização |
| `GET` | `/oauth/callback` | Recebe o código HMAC do pll-erp |
| `POST` | `/oauth/token` | Troca `auth_code` por JWT + refresh token |
| `POST` | `/oauth/refresh` | Renova o JWT via refresh token |

### MCP
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/mcp` | Envia requisição MCP (requer JWT) |
| `GET` | `/mcp` | Recupera resposta de sessão existente |
| `DELETE` | `/mcp` | Encerra uma sessão MCP |

### Geral
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Health check |

---

## Banco de Dados

### Tabelas Locais

| Tabela | Descrição |
|---|---|
| `oauth_tokens` | Tokens emitidos (access + refresh), suporte a revogação |
| `oauth_access_log` | Log de autenticações (colaborador, IP, timestamp) |
| `oauth_execution_log` | Log de execuções de ferramentas MCP |
| `mcp_ferramentas` | Registro de ferramentas MCP (RBAC) |
| `mcp_escopos` | Catálogo de escopos (`LEITURA`, `USO`) |
| `mcp_ferramentas_escopo` | Vínculo ferramenta ↔ escopo |
| `mcp_perfis_escopo` | Concessão de escopo por perfil (RBAC) |
| `mcp_ferramentas_log`, `mcp_escopos_log`, `mcp_ferramentas_escopo_log`, `mcp_perfis_escopo_log` | Versionamento (triggers `AFTER INSERT` / `BEFORE UPDATE`) das tabelas RBAC acima |

### Bancos Externos (somente leitura)

| Banco | Uso |
|---|---|
| `grupopll_master` | Dados de colaboradores (`cadastro_colaborador`), tipos de serviço (`os_tipo_servico`), status (`setor_status`) |
| `grupopll_crmoema` | Ordens de serviço (`os`) |

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão: 3000) |
| `PUBLIC_URL` | URL pública do servidor (usada como `iss`/`aud` do JWT e redirect URI base) |
| `DB_HOST` | Host do MySQL |
| `DB_PORT` | Porta do MySQL |
| `DB_USER` | Usuário do MySQL |
| `DB_PASSWORD` | Senha do MySQL |
| `DB_NAME` | Banco de dados padrão |
| `JWT_PRIVATE_KEY_B64` | Chave privada RSA em base64 (para assinar JWTs) |
| `JWT_PUBLIC_KEY_B64` | Chave pública RSA em base64 (para verificar JWTs) |
| `JWT_EXPIRES_IN` | Expiração do JWT em segundos (padrão: 3600) |
| `OAUTH_SECRET` | Segredo HMAC compartilhado com o pll-erp para validação de códigos |
| `B2B_LOGIN_URL` | URL da API B2B do pll-erp |
| `B2B_API_TOKEN` | Token de acesso à API B2B |
| `SOURCE_ROOT` | Raiz do repo usada por `read_tool_source` para resolver `src/tools/<arquivo>` (padrão: `process.cwd()`) |

---

## Segurança

- **HMAC-SHA256** com `timingSafeEqual` para validação de códigos do pll-erp.
- **RS256** para assinatura de JWTs (chave pública disponível via JWKS).
- **Single-rotation** de refresh tokens: o token anterior é revogado ao ser trocado.
- **TTL de estado**: estados OAuth expiram em 5 minutos.
- **Logs de auditoria** para todas as emissões de token e execuções de ferramentas.

---

## Stack Tecnológico

| Tecnologia | Versão | Uso |
|---|---|---|
| NestJS | 11.x | Framework principal |
| `@modelcontextprotocol/sdk` | 1.29.0 | Servidor MCP |
| `jose` | — | Assinatura/verificação JWT |
| `mysql2` | — | Conexão com MySQL |
| `passport-jwt` | — | Estratégia de autenticação JWT |
| `zod` | — | Validação de schemas |
| TypeScript | — | Linguagem |
