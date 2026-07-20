# Ferramenta: bypass_whatsapp_sent

**Nome interno:** `bypass_whatsapp_sent`
**Título de exibição:** `Bypass de envio WhatsApp (força reenvio)`
**Módulo:** `McpModule` (`src/mcp/mcp.service.ts`, `src/tools/mensageria.tool.ts`)
**Escopos necessários:** `USO` (concedido por perfil em `mcp_perfis_escopo` — ver [modules/mcp.md](../modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso))

---

## Descrição

Reenvia forçadamente um item da fila `whatsapp_sent` para o cliente,
**sobrescrevendo a validação de badlist/blacklist** e ignorando eventual erro
já registrado na mensagem. É uma ação sensível e com efeito colateral (não é
idempotente nem somente-leitura) — deve ser usada apenas quando o reenvio
manual for explicitamente solicitado, tipicamente por suporte/operação.

Por conta do bypass de blacklist, a concessão de `USO` deve ficar restrita a
perfis administrativos (`DEVS`/`ADMIN`), não a perfis operacionais em geral.

---

## Parâmetros de Entrada

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | number (inteiro positivo) | sim | ID do registro em `whatsapp_sent` a ser reenviado |

---

## Retorno

Repassa integralmente o corpo de resposta da API externa (formato definido
pelo serviço de mensageria, não normalizado por esta ferramenta).

---

## API Externa Chamada

```
POST https://api.grupopll.com.br/sac/notificacoes/message/process-single-force
Authorization: Bearer <token PLL>
Content-Type: application/json

{ "id": 134131 }
```

Autenticação via `PllApiAuthService` (mesmo host/credenciais `GRUPOPLL_API_URL`
usados por `cmv_parts_*` — nenhuma credencial nova foi necessária).

---

## Erros

| Situação | Retorno |
|---|---|
| Falha na chamada HTTP (API externa retorna erro) | `isError: true` com a mensagem de erro da API (ou `err.message` se não houver corpo) |

---

## Exemplo de Uso (via MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "bypass_whatsapp_sent",
    "arguments": { "id": 134131 }
  },
  "id": 1
}
```
