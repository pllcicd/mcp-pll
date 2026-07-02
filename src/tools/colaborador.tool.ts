import { z } from 'zod';
import type { ToolContext } from './types';

export function registerColaboradorTools({ server, pool, authorize }: ToolContext) {
  server.tool(
    'list_colaboradores',
    'Lista colaboradores com seus perfis de acesso (acesso_perfil normalizado em array) e status de cancelamento, com filtro opcional por nome ou email',
    {
      busca: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'Filtro opcional por nome ou email (busca parcial, aplicado com LIKE em ambas as colunas). Se omitido, lista todos os colaboradores.',
        ),
    },
    async ({ busca }) => {
      const deny = await authorize('list_colaboradores');
      if (deny) return deny;

      const where = busca ? 'WHERE nome LIKE ? OR email LIKE ?' : '';
      const params = busca ? [`%${busca}%`, `%${busca}%`] : [];

      const [rows] = await pool.execute<any[]>(
        `SELECT id, nome, email, acesso_perfil, cancelado
           FROM grupopll_master.cadastro_colaborador
           ${where}
           ORDER BY nome`,
        params,
      );

      const colaboradores = rows.map((row) => {
        let perfis: string[] = [];
        if (row.acesso_perfil) {
          try {
            const parsed =
              typeof row.acesso_perfil === 'string'
                ? JSON.parse(row.acesso_perfil)
                : row.acesso_perfil;
            perfis = Object.entries(parsed)
              .filter(([, v]) => v === true)
              .map(([k]) => k);
          } catch {
            // acesso_perfil malformado → sem perfis
          }
        }

        return {
          id: row.id,
          nome: row.nome,
          email: row.email,
          perfis,
          cancelado: row.cancelado,
        };
      });

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(colaboradores, null, 2) },
        ],
      };
    },
  );
}
