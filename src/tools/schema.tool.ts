import { z } from 'zod';
import type { ToolContext } from './types';

const TABELA_REGEX = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;

export function registerSchemaTools({ server, pool, authorize }: ToolContext) {
  server.tool(
    'view_schema',
    'Retorna o schema (colunas, tipos, chaves) de qualquer tabela do banco de dados',
    {
      tabela: z
        .string()
        .regex(
          TABELA_REGEX,
          'Formato esperado: "banco.tabela", ex.: grupopll_crmoema.os',
        )
        .describe('Nome completo da tabela no formato "banco.tabela"'),
    },
    async ({ tabela }) => {
      const deny = await authorize('view_schema');
      if (deny) return deny;

      const [banco, tabelaNome] = tabela.split('.');

      const [rows] = await pool.execute<any[]>(
        `SELECT
           COLUMN_NAME AS coluna,
           COLUMN_TYPE AS tipo,
           IS_NULLABLE AS aceita_nulo,
           COLUMN_KEY AS chave,
           COLUMN_DEFAULT AS valor_padrao,
           EXTRA AS extra
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ORDINAL_POSITION`,
        [banco, tabelaNome],
      );

      if (!rows.length) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tabela "${tabela}" não encontrada.`,
            },
          ],
        };
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );
}
