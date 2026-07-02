# Como adicionar uma nova ferramenta MCP

Guia autossuficiente: siga só este arquivo, sem precisar explorar o resto do
repositório. Cobre o padrão de código, onde registrar a ferramenta nas tabelas
RBAC e por que ela precisa de escopo antes de ficar disponível para alguém.

> Comando pronto: rode `/create-mcp-tool` no Claude Code dentro deste repositório
> — ele segue este mesmo guia. Definição em
> [.claude/commands/create-mcp-tool.md](../.claude/commands/create-mcp-tool.md).

---

## 1. O modelo de acesso, em uma frase

Nenhuma ferramenta é acessível por padrão. Toda ferramenta precisa: (a) existir no
código, (b) estar cadastrada em `mcp_ferramentas`, (c) ter seus escopos
(`LEITURA`/`USO`) vinculados em `mcp_ferramentas_escopo`, e (d) ter pelo menos um
perfil com esse escopo concedido em `mcp_perfis_escopo`. Sem os passos (b)-(d), a
ferramenta existe no código mas **ninguém** consegue chamá-la nem vê-la no
`tools/list` — nem o perfil `DEVS`, a menos que você a inclua no seed de
bootstrap do `schema.sql`.

Os dois escopos possíveis, por ferramenta:
- **`USO`** — permissão para executar a ferramenta. Sem `USO`, ela é removida do
  `tools/list` da sessão (via `RegisteredTool.disable()` em `McpService.createServer`)
  e qualquer chamada direta é rejeitada.
- **`LEITURA`** — permissão para ver o código-fonte da ferramenta via
  `read_tool_source`. Independente de `USO`.

Modelo completo: [docs/modules/mcp.md](modules/mcp.md#rbac-de-ferramentas-escopos-leitura--uso),
[docs/modules/scope.md](modules/scope.md), [docs/modules/database.md](modules/database.md#rbac-de-ferramentas-mcp_).

---

## 2. Implementar a ferramenta no código

Padrão do projeto: uma função `registerXxxTool(ctx: ToolContext)` por arquivo (ou
por grupo de ferramentas relacionadas) em `src/tools/`. Veja `whoami.tool.ts`
(uma ferramenta), `os.tool.ts` (três ferramentas relacionadas) ou `cmv.tool.ts`
(cinco ferramentas via helper compartilhado) para exemplos reais.

```typescript
// src/tools/cliente.tool.ts
import { z } from 'zod';
import type { ToolContext } from './types';

export function registerClienteTools({ server, pool, authorize }: ToolContext) {
  server.tool(
    'get_cliente',
    'Retorna os dados de um cliente pelo ID',
    { id: z.number().int().positive().describe('ID do cliente em grupopll_master.clientes') },
    async ({ id }) => {
      const deny = await authorize('get_cliente'); // SEMPRE a primeira linha do handler
      if (deny) return deny;

      const [rows] = await pool.execute<any[]>(
        `SELECT * FROM grupopll_master.clientes WHERE id = ?`,
        [id],
      );

      if (!rows.length) {
        return { content: [{ type: 'text', text: `Cliente ${id} não encontrado.` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
    },
  );
}
```

`ToolContext` (`src/tools/types.ts`) já entrega tudo que a ferramenta precisa:
`server`, `user` (`McpUser`, com `profiles`/`grants`), `pool` (mysql2), `authorize`
e `hasScope`. Não injete `ConfigService`/outros serviços Nest aqui — ferramentas
recebem só `ToolContext`.

Se a ferramenta precisar checar o escopo de **outra** ferramenta (como
`read_tool_source` faz com `LEITURA` do alvo), use `hasScope(nomeAlvo, 'LEITURA' | 'USO')`
em vez de `authorize`, que sempre checa `USO` da própria ferramenta chamada.

### Registrar em `src/mcp/mcp.service.ts`

Importe e chame `registerClienteTools(ctx)` dentro de `createServer`, junto às
demais `register*Tools(ctx)`. Nada mais é necessário aqui — o `Proxy` sobre
`server.tool` já desabilita automaticamente qualquer ferramenta sem `USO` para o
usuário da sessão.

---

## 3. Cadastrar a ferramenta nas tabelas RBAC

Feito **em runtime**, via as próprias ferramentas MCP de administração
(`src/tools/admin.tool.ts`) — nunca editando as tabelas na mão. Você precisa estar
autenticado com um perfil que já tenha `USO` nessas ferramentas admin (o perfil
`DEVS` tem, via bootstrap).

```json
{ "name": "admin_register_tool",    "arguments": { "nome": "get_cliente", "arquivo_fonte": "cliente.tool.ts", "descricao": "Retorna os dados de um cliente pelo ID" } }
{ "name": "admin_link_tool_scope",  "arguments": { "tool_nome": "get_cliente", "escopo_codigo": "USO" } }
{ "name": "admin_link_tool_scope",  "arguments": { "tool_nome": "get_cliente", "escopo_codigo": "LEITURA" } }
{ "name": "admin_grant_perfil_scope", "arguments": { "perfil_codigo": "CRM", "tool_nome": "get_cliente", "escopo_codigo": "USO" } }
```

- `arquivo_fonte` é o caminho **relativo a `src/tools/`** (ex.: `cliente.tool.ts`),
  usado por `read_tool_source` para ler o código do disco.
- Vincular `LEITURA` é opcional — só faça se quiser que alguém possa ler o código
  dessa ferramenta via `read_tool_source`.
- `admin_grant_perfil_scope` é o passo que de fato libera a ferramenta para quem
  tiver aquele perfil (chave `true` em `grupopll_master.cadastro_colaborador.acesso_perfil`).
  Sem essa concessão, a ferramenta existe mas está inacessível a todos.
- A concessão só passa a valer no próximo `/oauth/token` ou `/oauth/refresh` do
  colaborador — não instantaneamente para sessões já ativas com o access token
  antigo (o token tem TTL curto, `JWT_EXPIRES_IN`, e é renovado com frequência).
- Referência completa de parâmetros/erros de cada ferramenta admin:
  [tools/admin_register_tool.md](tools/admin_register_tool.md),
  [tools/admin_link_tool_scope.md](tools/admin_link_tool_scope.md),
  [tools/admin_grant_perfil_scope.md](tools/admin_grant_perfil_scope.md),
  [tools/admin_revoke_perfil_scope.md](tools/admin_revoke_perfil_scope.md),
  [tools/admin_list_grants.md](tools/admin_list_grants.md).

**Ferramenta que já deve nascer disponível a um perfil (ex.: `DEVS`) sem exigir
uma chamada manual pós-deploy?** Adicione-a ao bloco de seed em `schema.sql`
(veja como as 15 ferramentas atuais e o perfil `DEVS` são semeados lá — é
idempotente via `ON DUPLICATE KEY UPDATE`, seguro para reaplicar).

---

## 4. Documentar a ferramenta

Crie `docs/tools/<nome>.md` seguindo o template usado pelas ferramentas
existentes (ex.: [tools/get_os.md](tools/get_os.md), [tools/admin_register_tool.md](tools/admin_register_tool.md)):

```markdown
# Ferramenta: <nome>

**Nome interno:** `<nome>`
**Módulo:** `McpModule` (`src/tools/<arquivo>.tool.ts`)
**Escopos necessários:** `USO` em `<nome>` (concedido por perfil em `mcp_perfis_escopo`)

## Descrição
...
## Parâmetros de Entrada
...
## Retorno
...
## Query Executada
...
## Erros
...
## Exemplo de Uso (via MCP)
...
```

Depois, adicione uma linha na tabela de ferramentas em
[docs/index.md](index.md#ferramentas-mcp) e em
[docs/modules/mcp.md](modules/mcp.md) (seção "Ferramentas Implementadas").

---

## Checklist

- [ ] `registerXxxTool(ctx)` implementado em `src/tools/<arquivo>.tool.ts`, com `authorize('<nome>')` como primeira linha de cada handler
- [ ] Chamada de registro adicionada em `src/mcp/mcp.service.ts` (`createServer`)
- [ ] `admin_register_tool` executado (com `arquivo_fonte` correto)
- [ ] `admin_link_tool_scope` executado para `USO` (e `LEITURA`, se aplicável)
- [ ] `admin_grant_perfil_scope` executado para ao menos um perfil (ou incluído no seed de `schema.sql`)
- [ ] `docs/tools/<nome>.md` criado
- [ ] Linha adicionada em `docs/index.md` e `docs/modules/mcp.md`
- [ ] Mensagens de erro em português, JSON serializado via `JSON.stringify(x, null, 2)`, sem `console.log`
