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

### RBAC de ferramentas (`mcp_*`)

Quatro tabelas base implementam o controle de acesso por perfil (ver
[modules/mcp.md](mcp.md#rbac-de-ferramentas-escopos-leitura--uso) para o modelo
completo e [modules/scope.md](scope.md) para a resolução de concessões). Todas
seguem o mesmo padrão de colunas de auditoria, presentes em toda tabela:

| Coluna | Tipo | Descrição |
|---|---|---|
| `adicionado` | TIMESTAMP | Criação (default `CURRENT_TIMESTAMP`) |
| `cancelado` | TIMESTAMP NULL | Soft-delete — `NULL` = ativo |
| `fk_colaborador` | INT UNSIGNED NULL | Colaborador que fez a última alteração |

#### `mcp_ferramentas`

Registro de ferramentas MCP expostas pelo servidor.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Chave primária |
| `nome` | VARCHAR(255) UNIQUE | Casa com o nome usado em `server.tool('<nome>', ...)` |
| `descricao` | VARCHAR(1024) | Descrição da ferramenta |
| `arquivo_fonte` | VARCHAR(512) NULL | Caminho relativo a `src/tools/` (ex.: `os.tool.ts`), usado por `read_tool_source` |

#### `mcp_escopos`

Catálogo de escopos. Seed: `LEITURA` (ver código-fonte) e `USO` (executar).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Chave primária |
| `codigo` | VARCHAR(64) UNIQUE | `LEITURA`, `USO`, ou um novo código extensível |
| `descricao` | VARCHAR(1024) | Descrição do escopo |

#### `mcp_ferramentas_escopo`

Vínculo M:N — quais escopos cada ferramenta expõe.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Chave primária |
| `fk_ferramenta` | BIGINT UNSIGNED | → `mcp_ferramentas.id` (sem FK real — ver nota abaixo) |
| `fk_escopo` | BIGINT UNSIGNED | → `mcp_escopos.id` |

`UNIQUE (fk_ferramenta, fk_escopo)` — não há linhas duplicadas para o mesmo par.

#### `mcp_perfis_escopo`

A concessão RBAC propriamente dita: liga um **perfil** a um par ferramenta+escopo.
A presença de uma linha não cancelada é o que concede acesso.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Chave primária |
| `perfil_codigo` | VARCHAR(64) | Código do perfil (mesma chave de `acesso_perfil` no JSON) |
| `fk_ferramenta_escopo` | BIGINT UNSIGNED | → `mcp_ferramentas_escopo.id` |

`UNIQUE (perfil_codigo, fk_ferramenta_escopo)` — por isso revogar é sempre soft-delete
(`cancelado = NOW()`) e re-conceder é sempre um "undelete" (`UPDATE ... SET cancelado = NULL`),
nunca um novo `INSERT` — a unique key bloquearia a duplicata.

Nenhuma das quatro tabelas usa `FOREIGN KEY` real: as referências internas
(`fk_ferramenta`, `fk_escopo`, `fk_ferramenta_escopo`) e externas (`fk_colaborador`,
`perfil_codigo`) são colunas simples, seguindo a convenção já usada nas tabelas
`oauth_*` — evita bloqueios de FK ao fazer soft-delete de um "pai" que ainda tem
"filhos" cancelados.

#### Tabelas de versionamento (`_log`)

Cada tabela base tem uma gêmea `_log` (`mcp_ferramentas_log`, `mcp_escopos_log`,
`mcp_ferramentas_escopo_log`, `mcp_perfis_escopo_log`) que espelha suas colunas de
negócio e adiciona:

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Chave primária da própria linha de log |
| `id_registro` | BIGINT UNSIGNED | `id` da linha base versionada |
| `operacao` | VARCHAR(16) | `INSERT` ou `UPDATE` |
| `registrado_em` | TIMESTAMP | Quando esta versão foi registrada |

Alimentadas por triggers `AFTER INSERT` (grava `NEW` — versão de nascimento) e
`BEFORE UPDATE` (grava `OLD` — pré-imagem antes da alteração). A linha base atual
somada a todas as pré-imagens em `_log` reconstroem o histórico completo de cada
registro, inclusive soft-deletes via `cancelado`. Ver DDL e triggers completos em
[`schema.sql`](../../schema.sql).

---

## Bancos Externos (somente leitura)

| Banco | Tabelas Acessadas | Módulo |
|---|---|---|
| `grupopll_master` | `cadastro_colaborador`, `os_tipo_servico`, `setor_status` | `ColaboradorModule`, `McpModule` |
| `grupopll_crmoema` | `os` | `McpModule` |

> `mcp_perfis_escopo.perfil_codigo` assume o mesmo valor das chaves do JSON
> `cadastro_colaborador.acesso_perfil`, que por sua vez devem corresponder aos códigos
> de `grupopll_master.cadastro_colaborador_perfil.codigo`. Essa tabela não é
> consultada diretamente pelo código — é apenas a referência conceitual do que é um
> "código de perfil" válido.
