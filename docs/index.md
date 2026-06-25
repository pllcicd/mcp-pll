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
| `DatabaseModule` | Pool de conexões MySQL global | [modules/database.md](modules/database.md) |
| `B2BModule` | Cliente HTTP para a API B2B do pll-erp (legado) | [modules/b2b.md](modules/b2b.md) |
| `UserModule` | Autenticação por senha (legado, não usado no fluxo OAuth) | [modules/user.md](modules/user.md) |

---

## Ferramentas MCP

| Ferramenta | Descrição | Escopos Necessários | Documentação |
|---|---|---|---|
| `whoami` | Retorna informações do usuário autenticado | nenhum | [tools/whoami.md](tools/whoami.md) |
| `get_os` | Busca uma Ordem de Serviço pelo ID | nenhum | [tools/get_os.md](tools/get_os.md) |
| `get_service_title` | Busca o título de um tipo de serviço pelo ID | nenhum | [tools/get_service_title.md](tools/get_service_title.md) |
| `get_status_title` | Busca o título de um status de setor pelo ID | nenhum | [tools/get_status_title.md](tools/get_status_title.md) |
| `cmv_parts_rupture_analysis` | Relatório CMV: Análise de Ruptura de Peças | nenhum | [tools/cmv_parts_rupture_analysis.md](tools/cmv_parts_rupture_analysis.md) |
| `cmv_parts_consumption_physical_match` | Relatório CMV: Consumo Casado Fisicamente | nenhum | [tools/cmv_parts_consumption_physical_match.md](tools/cmv_parts_consumption_physical_match.md) |
| `cmv_parts_consumption_systemic_match` | Relatório CMV: Consumo Casado Sistemicamente | nenhum | [tools/cmv_parts_consumption_systemic_match.md](tools/cmv_parts_consumption_systemic_match.md) |
| `cmv_parts_consumption_awaiting_match` | Relatório CMV: Consumo Aguardando Casamento | nenhum | [tools/cmv_parts_consumption_awaiting_match.md](tools/cmv_parts_consumption_awaiting_match.md) |
| `cmv_parts_operational_loss` | Relatório CMV: Perda Operacional | nenhum | [tools/cmv_parts_operational_loss.md](tools/cmv_parts_operational_loss.md) |

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
