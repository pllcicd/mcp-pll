# Módulo: User

**Localização:** `src/user/`

Módulo legado de autenticação por usuário e senha. **Não está integrado ao fluxo OAuth atual.**

---

## Arquivos

### `user.module.ts`

Importa `DatabaseModule` e exporta `UserService`.

---

### `user.service.ts` — `UserService`

#### `findByEmail(email: string)`

Busca um usuário pelo e-mail na tabela `users` do banco local.

```sql
SELECT id, email, password FROM users WHERE email = ? LIMIT 1
```

Retorna `null` se não encontrado.

#### `validatePassword(plain: string, hash: string)`

Compara uma senha em texto plano com o hash bcrypt armazenado.

```typescript
await bcrypt.compare(plain, hash)  // retorna boolean
```

---

## Status

Este módulo implementa autenticação tradicional (email + senha) que não é usada no fluxo OAuth atual baseado em HMAC/JWT. Pode ser removido ou reutilizado caso o projeto precise suportar login direto no futuro.
