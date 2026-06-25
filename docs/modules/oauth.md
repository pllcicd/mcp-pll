# Módulo: OAuth

**Localização:** `src/oauth/`

Implementa o fluxo OAuth 2.0 Authorization Code Flow completo, adaptado para a integração entre Claude AI (cliente MCP) e o sistema de autenticação do Grupo PLL (pll-erp).

---

## Arquivos

### `oauth.module.ts`

Importa `AuthModule`, `ColaboradorModule` e `DatabaseModule`. Registra `OAuthService` e `OAuthController`.

---

### `oauth.service.ts` — `OAuthService`

Núcleo do fluxo OAuth. Gerencia estados, valida códigos HMAC, gera tokens e persiste tudo no banco.

#### Estado em Memória

**Pending States** (`Map<ourState, PendingState>`)
- Chave: `ourState` — UUID gerado pelo servidor no início do fluxo.
- Valor: `{ claudeRedirectUri, claudeState, expiresAt }` — dados do cliente Claude salvos para uso no callback.
- TTL: 5 minutos.

**Auth Codes** (`Map<code, AuthCodeEntry>`)
- Chave: código de autorização opaco (UUID) gerado após validação do callback.
- Valor: `{ colaboradorId, redirectUri, expiresAt }`.
- TTL: 5 minutos. Uso único (removido ao ser trocado por token).

#### Métodos Principais

**`savePendingState(ourState, claudeRedirectUri, claudeState)`**

Salva o estado do Claude para recuperação no callback.

---

**`validateHmacCode(code, redirectUri)`**

Valida o código HMAC gerado pelo pll-erp.

Formato esperado do código: `<base64url(payload)>.<hmac-sha256-hex>`

O payload JSON contém:
```json
{
  "colaboradorId": 123,
  "exp": 1718000000,
  "redirectUri": "https://..."
}
```

Verificações realizadas:
1. Formato correto (duas partes separadas por `.`).
2. Assinatura HMAC-SHA256 válida (usando `OAUTH_SECRET`, com `timingSafeEqual`).
3. Timestamp `exp` não expirado.
4. `redirectUri` dentro do payload corresponde ao parâmetro recebido.

Retorna `{ colaboradorId }` em caso de sucesso.

---

**`generateAuthCode(colaboradorId, redirectUri)`**

Cria um código de autorização de uso único (UUID) e o armazena no mapa interno. Retorna o código.

---

**`generateTokens(colaboradorId, scope, sessionId?)`**

Gera e persiste o par de tokens:

- **Access Token (JWT RS256)**:
  - Claims: `sub` (colaboradorId), `email`, `nome`, `scope`, `jti` (UUID), `iss`, `aud` (PUBLIC_URL), `exp`
  - Assinado com `KeysService.getPrivateKey()`

- **Refresh Token**:
  - 40 bytes aleatórios em base64url
  - Persistido na tabela `oauth_tokens` junto com o `jti` do access token

Registra o evento em `oauth_access_log`.

---

**`refreshToken(token)`**

Rotaciona o refresh token:
1. Busca o registro ativo na tabela `oauth_tokens`.
2. Valida que não está revogado e não expirou.
3. Marca o registro atual como `revoked = 1`.
4. Chama `generateTokens` para emitir um novo par.

Padrão single-rotation: um refresh token só pode ser usado uma vez.

---

**`getDiscoveryMetadata()`**

Retorna o objeto de metadados OAuth 2.0 (RFC 8414) com todos os endpoints e capacidades do servidor.

---

### `oauth.controller.ts` — `OAuthController`

Expõe todos os endpoints do fluxo OAuth.

#### `GET /.well-known/oauth-authorization-server`

Retorna os metadados de discovery do servidor OAuth.

#### `GET /.well-known/jwks.json`

Retorna as chaves públicas do servidor em formato JWKS para que clientes verifiquem JWTs.

#### `POST /oauth/register`

Registro dinâmico de cliente (RFC 7591). Gera um `client_id` UUID para o cliente que se registrar. Não requer autenticação.

Corpo aceito (opcional):
```json
{
  "redirect_uris": ["https://..."],
  "client_name": "Nome do cliente"
}
```

Resposta:
```json
{
  "client_id": "<uuid>",
  "client_id_issued_at": 1718000000,
  "redirect_uris": [...],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

---

#### `GET /oauth/authorize`

**Passo 1 do fluxo.** Recebe os parâmetros do cliente Claude e redireciona o usuário para o pll-erp.

Query params obrigatórios: `response_type=code`, `client_id`, `redirect_uri`, `state`.

Ações:
1. Gera `ourState` (UUID) e salva junto com `redirect_uri` e `state` do Claude.
2. Redireciona para `B2B_LOGIN_URL?state=<ourState>&redirect_uri=<nossa_callback_url>`.

---

#### `GET /oauth/callback`

**Passo 2 do fluxo.** Recebe o código HMAC do pll-erp após autenticação do colaborador.

Query params: `code` (HMAC assinado), `state` (nosso `ourState`).

Ações:
1. Recupera o estado pendente pelo `ourState`.
2. Valida o código HMAC via `OAuthService.validateHmacCode`.
3. Gera um `auth_code` de uso único.
4. Redireciona para o `claudeRedirectUri` com `?code=<auth_code>&state=<claudeState>`.

---

#### `POST /oauth/token`

**Passo 3 do fluxo.** Troca o `auth_code` por tokens.

Body (form-urlencoded ou JSON):
```
grant_type=authorization_code
code=<auth_code>
redirect_uri=<redirect_uri>
client_id=<client_id>
```

Ações:
1. Valida o `auth_code` (TTL, `redirect_uri`).
2. Remove o código do mapa (uso único).
3. Emite JWT + refresh token via `generateTokens`.

Resposta:
```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<opaque>",
  "scope": "modulo1 modulo2"
}
```

---

#### `POST /oauth/refresh`

**Passo 4 do fluxo.** Renova o access token via refresh token.

Body:
```
grant_type=refresh_token
refresh_token=<token>
```

Rotaciona o refresh token e emite um novo par. Retorna o mesmo formato de `/oauth/token`.

---

## Segurança

- Codes HMAC verificados com `crypto.timingSafeEqual` (proteção contra timing attacks).
- Estados e códigos têm TTL de 5 minutos.
- Refresh tokens são single-rotation (uso único).
- Todos os tokens emitidos são persistidos para auditoria.
