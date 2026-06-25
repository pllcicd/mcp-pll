# Módulo: Database

**Localização:** `src/database/`

Provê um pool de conexões MySQL reutilizável para todos os módulos da aplicação.

---

## Arquivos

### `database.module.ts`

Módulo global que cria e exporta um pool de conexões MySQL.

**Configuração do Pool**

| Parâmetro | Variável de Ambiente | Padrão |
|---|---|---|
| Host | `DB_HOST` | — |
| Porta | `DB_PORT` | — |
| Usuário | `DB_USER` | — |
| Senha | `DB_PASSWORD` | — |
| Banco | `DB_NAME` | — |
| Limite de conexões | — | 10 |

**Token de Injeção:** `DB_POOL`

Qualquer módulo que importe `DatabaseModule` pode injetar o pool via:

```typescript
@Inject('DB_POOL') private readonly db: Pool
```

**Uso**

```typescript
const [rows] = await this.db.execute('SELECT * FROM tabela WHERE id = ?', [id]);
```

Usa `mysql2/promise` para suporte nativo a `async/await`.

---

## Tabelas Locais

Definidas em [`schema.sql`](../../schema.sql).

### `oauth_tokens`

Armazena todos os tokens emitidos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Chave primária |
| `colaborador_id` | INT | ID do colaborador autenticado |
| `user_session_id` | VARCHAR | Identificador de sessão do cliente |
| `access_jti` | VARCHAR | JWT ID do access token (UUID) |
| `refresh_token` | VARCHAR | Token de refresh opaco (base64url) |
| `scope` | TEXT | Escopos concedidos (separados por espaço) |
| `expires_at` | DATETIME | Expiração do access token |
| `refresh_expires_at` | DATETIME | Expiração do refresh token |
| `revoked` | TINYINT | 0 = ativo, 1 = revogado |
| `created_at` | DATETIME | Data de criação |

### `oauth_access_log`

Registra cada emissão de token.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Chave primária |
| `colaborador_id` | INT | ID do colaborador |
| `user_session_id` | VARCHAR | Identificador de sessão |
| `ip` | VARCHAR | IP de origem (quando disponível) |
| `created_at` | DATETIME | Timestamp do evento |

### `oauth_execution_log`

Registra cada execução de ferramenta MCP.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Chave primária |
| `colaborador_id` | INT | ID do colaborador |
| `tool_name` | VARCHAR | Nome da ferramenta executada |
| `created_at` | DATETIME | Timestamp da execução |

---

## Bancos Externos (somente leitura)

| Banco | Tabelas Acessadas | Módulo |
|---|---|---|
| `grupopll_master` | `cadastro_colaborador`, `os_tipo_servico`, `setor_status` | `ColaboradorModule`, `McpModule` |
| `grupopll_crmoema` | `os` | `McpModule` |
