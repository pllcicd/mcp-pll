# mcp-pll

## Alterações de schema do banco

`schema.sql` é a fotografia completa do schema (para banco novo). **Nunca**
editar `schema.sql` como única forma de propagar uma alteração em bancos já
existentes — todo `CREATE TABLE` ali é `IF NOT EXISTS`, então reaplicar o
arquivo não roda `ALTER TABLE` nenhum.

Sempre que uma mudança de código exigir alteração de schema (nova coluna,
tabela, índice, etc.):

1. Atualize `schema.sql` para refletir o schema atual (banco novo já nasce certo).
2. Crie uma migration em `migrations/AAAAMMDD_HHMM/schema.sql` com os
   `ALTER TABLE`/`CREATE TABLE` idempotentes daquela mudança específica.

Ver `migrations/README.md` para o formato exato — inclui como fazer
`ALTER TABLE` idempotente em **MySQL puro** (`ADD COLUMN IF NOT EXISTS` é
sintaxe do MariaDB e não funciona aqui). Essa é uma premissa fixa do
projeto — não pular a migration mesmo em mudanças pequenas.
