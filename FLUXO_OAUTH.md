# Fluxo OAuth — MCP Server via pll-erp (HMAC)

## Visão geral

O login é delegado ao pll-erp. O MCP server nunca vê a senha do usuário — ele recebe um
**code assinado com HMAC-SHA256** e o verifica **localmente** (sem chamada de volta ao B2B).

```
MCP Server                    pll-erp (B2B)                    Usuário
    │                               │                               │
    │──── 1. Redireciona usuário ──▶│                               │
    │     /?redirect_uri=.../       │                               │
    │     oauth/callback            │◀──── 2. Login + 2FA ─────────│
    │     &state=<ourState>         │──── 3. Gera code HMAC ───────│
    │◀─── 4. Callback com code ─────│                               │
    │     /oauth/callback           │                               │
    │     ?code=<hmac>&state=<s>    │                               │
    │                               │                               │
    │──── 5. Verifica HMAC local ───┤                               │
    │     (sem chamada ao B2B)      │                               │
    │──── 6. Redireciona ao Claude ─┼───────────────────────────────▶
    │     ?code=<ourCode>&state=<s> │
```

---

## Passo 1 — Claude inicia o fluxo

```
Claude → GET /oauth/authorize?redirect_uri=https://claude.ai/...&state=<claude_state>
```

O servidor:
1. Salva `{ claudeRedirectUri, claudeState }` em memória com TTL de 5 min, indexado por `ourState`
2. Gera `ourState = randomBytes(16).hex()`
3. Redireciona ao pll-erp:

```
302 → https://erp.pllb2b.com.br/?redirect_uri=https://<PUBLIC_URL>/oauth/callback&state=<ourState>
```

---

## Passo 2 — Usuário faz login no pll-erp

O pll-erp autentica o usuário (login + 2FA se aplicável), gera o code HMAC e redireciona:

```
302 → https://<PUBLIC_URL>/oauth/callback?code=<hmac_code>&state=<ourState>
```

### Formato do code (gerado pelo pll-erp)

```
<base64(payload_json)>.<hmac-sha256-hex>
```

Payload JSON:
```json
{
  "colaboradorId": 545,
  "exp": 1718900000,
  "redirectUri": "https://<PUBLIC_URL>/oauth/callback"
}
```

A assinatura é `HMAC-SHA256(base64(payload), OAUTH_SECRET)`.

---

## Passo 3 — Callback no MCP server (`GET /oauth/callback`)

O servidor:
1. Consome e valida `ourState` (previne CSRF)
2. Verifica o code HMAC-SHA256 **localmente**:
   - Timing-safe compare da assinatura
   - Valida `exp` (TTL configurado no pll-erp, normalmente 60s)
   - Valida `redirectUri` dentro do payload
3. Extrai `colaboradorId` do payload
4. Gera nosso próprio `authCode` (random 32 bytes base64url, TTL 5 min)
5. Redireciona ao Claude:

```
302 → https://claude.ai/...?code=<authCode>&state=<claude_state>
```

---

## Passo 4 — Claude troca o code por tokens (`POST /oauth/token`)

```
POST /oauth/token
{ grant_type: "authorization_code", code: "<authCode>", redirect_uri: "..." }
```

O servidor:
1. Consome o `authCode` (single-use) → extrai `colaboradorId`
2. `SELECT id, email, nome, modulos FROM grupopll_master.cadastro_colaborador WHERE id = ?`
3. Emite JWT RS256 (claims: `sub=colaboradorId`, `scope`, `email`, `nome`, `exp`)
4. Gera `refresh_token` opaco (40 bytes base64url)
5. `INSERT INTO oauth_tokens`
6. `INSERT INTO oauth_access_log` (IP do cliente)

```json
{
  "access_token":  "<JWT RS256>",
  "refresh_token": "<opaco>",
  "token_type":    "Bearer",
  "expires_in":    3600
}
```

---

## Passo 5 — Uso das tools MCP

```
POST /mcp
Authorization: Bearer <access_token>
```

1. `JwtAuthGuard` valida o JWT (RS256, issuer, audience)
2. `req.user = { userId, email, nome, scopes: ["vendas", ...] }`
3. Cada tool verifica `TOOL_SCOPES[toolName] ⊆ user.scopes`
   - Autorizado → executa + `INSERT INTO oauth_execution_log`
   - Negado     → `"Acesso negado: a tool X requer o scope Y"`

---

## Passo 6 — Renovação do access_token (`POST /oauth/refresh`)

```
POST /oauth/refresh
{ grant_type: "refresh_token", refresh_token: "<token>" }
```

1. `SELECT` em `oauth_tokens` (não revogado, `refresh_expires_at > NOW()`)
2. `UPDATE revoked = 1` no token antigo ← single-rotation
3. Busca dados atualizados do colaborador (fallback: usa scopes armazenados)
4. Emite novo JWT + novo `refresh_token`
5. `INSERT` nova linha em `oauth_tokens`

```json
{
  "access_token":  "<novo JWT>",
  "refresh_token": "<novo opaco>",
  "token_type":    "Bearer",
  "expires_in":    3600
}
```

---

## TTLs

| Item | Validade |
|---|---|
| `ourState` (pendente) | 5 min (tempo para login no B2B) |
| HMAC code (do B2B) | ~60s (configurado no pll-erp) |
| `authCode` (nosso) | 5 min (tempo para o Claude trocar) |
| `access_token` JWT | 1h (`JWT_EXPIRES_IN`) |
| `refresh_token` | 30 dias |

---

## Tabelas do banco (`ai_mcp`)

| Tabela | Finalidade |
|---|---|
| `oauth_tokens` | Tokens emitidos (jti + refresh, scopes, expiração, revogação) |
| `oauth_access_log` | Auditoria: quem autenticou, quando e de qual IP |
| `oauth_execution_log` | Auditoria: qual colaborador chamou qual tool MCP e quando |

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PUBLIC_URL` | URL pública deste servidor |
| `B2B_LOGIN_URL` | URL de login do pll-erp (ex.: `https://erp.pllb2b.com.br/`) |
| `OAUTH_SECRET` | Segredo HMAC — deve ser **idêntico** ao `OAUTH_SECRET` no `OAuthCode.php` |
| `JWT_EXPIRES_IN` | Duração do access_token em segundos (padrão: `3600`) |
| `JWT_PRIVATE_KEY_B64` | Chave privada RSA em base64 |
| `JWT_PUBLIC_KEY_B64` | Chave pública RSA em base64 |

---

## Checklist de validação no MCP server

| Verificação | Proteção |
|---|---|
| `ourState` recebido === `ourState` gerado | CSRF no fluxo OAuth |
| HMAC-SHA256 com `timingSafeEqual` | Autenticidade do code (timing attack) |
| `exp` > `now` | Replay de code expirado |
| `redirectUri` no payload === URI do callback | Reutilização em outro contexto |
| `authCode` single-use + TTL 5 min | Replay do auth code |
| `refresh_token` single-rotation | Reutilização de refresh token |

---

## Configuração necessária no pll-erp

Whitelist em `OAuthCode::WHITELIST` — adicionar a URL pública do MCP server:
```php
private const WHITELIST = [
    'https://claude.ai',
    'https://<seu-subdominio>.ngrok.io', // ou URL de produção
];
```

`OAUTH_SECRET` deve ser idêntico nos dois lados:
```php
private const OAUTH_SECRET = 'sua_chave_secreta_aqui'; // OAuthCode.php
```
```env
OAUTH_SECRET=sua_chave_secreta_aqui  # .env do MCP server
```

---

## Ajustes necessários antes de usar

1. **Colunas de `cadastro_colaborador`** — em `src/colaborador/colaborador.service.ts`,
   ajustar nomes das colunas (`email`, `nome`, `modulos`) para o schema real.

2. **Scopes por tool** — em `src/mcp/mcp.service.ts`, preencher `TOOL_SCOPES` com os
   nomes reais das tools e os módulos correspondentes.

3. **Aplicar o schema no banco:**
   ```bash
   mysql -u root -p < schema.sql
   ```
