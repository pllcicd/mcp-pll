# Módulo: Auth

**Localização:** `src/auth/`

Responsável pela geração, validação e gerenciamento de tokens JWT RS256. Provê a estratégia Passport usada para proteger endpoints, além do serviço que gerencia o par de chaves RSA.

---

## Arquivos

### `auth.module.ts`

Declara e exporta os providers do módulo. Importa `PassportModule` e `ConfigModule`. Registra `KeysService` e `JwtStrategy` como providers.

---

### `keys.service.ts` — `KeysService`

Gerencia o par de chaves RSA usado para assinar e verificar JWTs.

**Inicialização (`onModuleInit`)**

1. Tenta carregar as chaves das variáveis de ambiente `JWT_PRIVATE_KEY_B64` e `JWT_PUBLIC_KEY_B64` (ambas em base64).
2. Se não encontrar, gera um novo par RSA-2048 em memória (apenas para desenvolvimento).

**Métodos públicos**

| Método | Retorno | Descrição |
|---|---|---|
| `getPrivateKey()` | `CryptoKey` | Chave privada para assinar tokens |
| `getPublicKey()` | `CryptoKey` | Chave pública para verificar tokens |
| `getPublicKeySpki()` | `string` | Chave pública em formato PEM (SPKI) |
| `getJwks()` | `object` | Chave pública em formato JWKS (`{ keys: [...] }`) |

---

### `jwt.strategy.ts` — `JwtStrategy`

Estratégia Passport que valida JWTs em requisições protegidas.

**Configuração**
- Algoritmo: `RS256`
- Chave de verificação: obtida de `KeysService`
- Extrator: Bearer token do header `Authorization`
- `issuer` e `audience`: valor de `PUBLIC_URL`

**`validate(payload)`**

Chamado após a assinatura ser verificada com sucesso. Retorna o objeto de usuário que será injetado no `request.user`:

```typescript
{
  userId: payload.sub,
  email: payload.email,
  nome: payload.nome,
  scopes: string[],   // parsado de payload.scope (string separada por espaços)
}
```

---

### `jwt-auth.guard.ts` — `JwtAuthGuard`

Guard simples que estende `AuthGuard('jwt')` do Passport. Aplicado via `@UseGuards(JwtAuthGuard)` em endpoints que exigem autenticação.

---

## Dependências

- `KeysService` é exportado pelo módulo e injetado em `OAuthService` (para assinar tokens) e em `JwtStrategy` (para verificar tokens).
- `JwtAuthGuard` é usado em `McpController`.
