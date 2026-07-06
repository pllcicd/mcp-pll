# Migrations

`schema.sql` (na raiz do projeto) é a fotografia completa do schema para um
banco novo — todo `CREATE TABLE` é `IF NOT EXISTS`, então rodar esse arquivo
num banco já existente não aplica mudanças incrementais.

Toda alteração de schema em cima de um banco já existente (nova coluna, nova
tabela, novo índice, etc.) deve:

1. Ser refletida também em `schema.sql` (para que um banco novo já nasça com
   o schema atual).
2. Ganhar uma migration nesta pasta: `migrations/AAAAMMDD_HHMM/schema.sql`
   contendo os `ALTER TABLE`/`CREATE TABLE` daquela mudança específica, com um
   comentário no topo explicando o contexto/motivo da mudança.

   Este banco é **MySQL** (não MariaDB): `ADD COLUMN IF NOT EXISTS` e
   `ADD KEY IF NOT EXISTS` **não existem** em MySQL (são extensão do
   MariaDB) e dão erro de sintaxe. Para manter a migration idempotente
   (segura de reaplicar), condicione cada `ALTER TABLE` a uma checagem em
   `information_schema` + SQL preparado dinamicamente. Ver
   `migrations/20260706_1603/schema.sql` como modelo do padrão a seguir.
   `CREATE TABLE IF NOT EXISTS` continua funcionando normalmente (isso é
   suportado nativamente pelo MySQL).

Formato da pasta: `AAAAMMDD_HHMM` (data e hora de criação da migration, ex.:
`20260706_1603`). Isso mantém a ordem cronológica e permite reconstruir o
histórico do schema aplicando as migrations em sequência.

Aplicar uma migration:
```
mysql -u root -p ai_mcp < migrations/AAAAMMDD_HHMM/schema.sql
```

Não editar migrations já commitadas — se algo estiver errado, crie uma nova
migration corrigindo.
