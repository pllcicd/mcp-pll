# Integração OAuth — pll-erp → MCP Server

## Visão geral do fluxo

```
MCP Server                    pll-erp (b2b)                    Usuário
    │                               │                               │
    │──── 1. Redireciona usuário ──▶│                               │
    │     /?redirect_uri=...        │                               │
    │     &state=<random>           │◀──── 2. Login + 2FA ─────────│
    │                               │──── 3. Gera code HMAC ───────│
    │◀─── 4. Callback com code ─────│                               │
    │     ?code=<hmac>&state=<s>    │                               │
    │                               │                               │
    │──── 5. Verifica code local ───│                               │
    │     (sem chamada ao b2b)      │                               │
    │──── 6. Usa colaboradorId ─────│                               │
```

---

## Passo 1 — Iniciar o fluxo (MCP → pll-erp)

O MCP server gera um `state` aleatório, armazena na sessão do usuário e redireciona:

```typescript
import crypto from 'crypto';

function startOAuth(res: Response) {
    const state = crypto.randomBytes(16).toString('hex');

    // Armazena state na sessão para validar no callback
    session.set('oauth_state', state);

    const params = new URLSearchParams({
        redirect_uri: 'http://127.0.0.1:PORT/callback', // porta que o MCP escuta
        state,
    });

    res.redirect(`https://erp.pllb2b.com.br/?${params}`);
}
```

---

## Passo 2 — Receber o callback

```typescript
function handleCallback(req: Request, res: Response) {
    const { code, state } = req.query;

    // Valida state para prevenir CSRF
    if (state !== session.get('oauth_state')) {
        return res.status(400).send('State inválido');
    }
    session.delete('oauth_state');

    const colaboradorId = verifyOAuthCode(
        code as string,
        'http://127.0.0.1:PORT/callback'
    );

    // Usa o colaboradorId para identificar o usuário
    session.set('colaboradorId', colaboradorId);
    res.redirect('/');
}
```

---

## Passo 3 — Verificar o code (sem chamada ao pll-erp)

```typescript
const OAUTH_SECRET = 'mesmo_valor_do_OAuthCode.php';
const CODE_TTL     = 60; // segundos — deve bater com o PHP

function verifyOAuthCode(code: string, redirectUri: string): number {
    const [payload, sig] = code.split('.');

    if (!payload || !sig) {
        throw new Error('Formato de code inválido');
    }

    // 1. Verifica assinatura HMAC-SHA256
    const expected = crypto
        .createHmac('sha256', OAUTH_SECRET)
        .update(payload)
        .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        throw new Error('Assinatura inválida');
    }

    // 2. Decodifica payload
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

    // 3. Valida expiração
    if (Math.floor(Date.now() / 1000) > data.exp) {
        throw new Error('Code expirado');
    }

    // 4. Valida audience (redirect_uri deve bater com o que foi usado no início)
    if (data.redirectUri !== redirectUri) {
        throw new Error('redirect_uri não corresponde');
    }

    return data.colaboradorId as number; // ex: 545
}
```

---

## Configuração necessária

**No `OAuthCode.php` (pll-erp):**
```php
private const OAUTH_SECRET = 'sua_chave_aqui';
```

**No MCP server:**
```typescript
const OAUTH_SECRET = 'sua_chave_aqui'; // idêntico ao PHP
```

**Whitelist no pll-erp** — adicione a URL do seu MCP server em `OAuthCode::WHITELIST`:
```php
private const WHITELIST = [
    'https://claude.ai',
    'http://127.0.0.1',   // MCP local (porta dinâmica, qualquer porta)
];
```

---

## Checklist de validação no MCP server

| Verificação | Por quê |
|---|---|
| `state` recebido === `state` gerado | Previne CSRF no fluxo OAuth |
| HMAC-SHA256 com `timingSafeEqual` | Garante autenticidade do code |
| `exp` > `now` | Rejeita codes expirados (TTL 60s) |
| `redirectUri` no payload === URI usada | Previne reutilização em outro contexto |

---

## Arquivos envolvidos no pll-erp

| Arquivo | Responsabilidade |
|---|---|
| `index.php` | Valida whitelist, busca `colaboradorId`, gera code HMAC |
| `admin/index.php` | Preserva `redirect_uri` + `state` pelo fluxo de login |
| `admin/acessar-empresa.php` | Valida whitelist, preserva params pela seleção de empresa |
| `libs/core/domain/oauth/OAuthCode.php` | Whitelist, geração HMAC, constante `OAUTH_SECRET` |
| `.htaccess` | Exceção WAF para rotas OAuth (mantém bloqueio de XSS) |
