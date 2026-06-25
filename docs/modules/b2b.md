# Módulo: B2B

**Localização:** `src/b2b/`

Cliente HTTP para a API B2B do pll-erp. Atualmente não está integrado ao fluxo OAuth principal — foi substituído pela validação HMAC direta.

---

## Arquivos

### `b2b.module.ts`

Importa `ConfigModule` e exporta `B2BService`.

---

### `b2b.service.ts` — `B2BService`

#### `getLogin(sessionId: string)`

Chama a API B2B para obter informações de uma sessão.

**Endpoint:** `GET {B2B_API_URL}/session-information/{sessionId}`

**Headers:**
```
Authorization: Bearer {B2B_API_TOKEN}
Content-Type: application/json
```

**Retorno esperado:**
```json
{
  "colaboradorId": 123
}
```

---

## Status

Este módulo está presente no código mas **não é utilizado no fluxo atual**. O fluxo OAuth usa validação HMAC direta (sem chamada de volta ao pll-erp) para verificar a identidade do colaborador, tornando este serviço redundante.

Pode ser reativado caso seja necessário validar sessões via back-channel no futuro.

**Variáveis de ambiente necessárias:**
- `B2B_API_URL`
- `B2B_API_TOKEN`
