import { z } from 'zod';
import type { ToolContext } from './types';

export function registerOsTools({ server, pool, authorize }: ToolContext) {
  server.tool(
    'get_os',
    'Retorna todos os dados brutos de uma OS',
    {
      id: z
        .number()
        .int()
        .positive()
        .describe('ID da OS em grupopll_crmoema.os'),
    },
    async ({ id }) => {
      const deny = await authorize('get_os');
      if (deny) return deny;

      const [rows] = await pool.execute<any[]>(
        `SELECT os.* FROM grupopll_crmoema.os os WHERE os.id = ?`,
        [id],
      );

      if (!rows.length) {
        return {
          content: [
            { type: 'text' as const, text: `OS ${id} não encontrada.` },
          ],
        };
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows[0], null, 2) },
        ],
      };
    },
  );

  server.tool(
    'get_service_title',
    'Retorna o tipo de serviço associado à um ID',
    {
      id: z
        .number()
        .int()
        .positive()
        .describe('ID do tipo de serviço em grupopll_master.os_tipo_servico'),
    },
    async ({ id }) => {
      const deny = await authorize('get_service_title');
      if (deny) return deny;

      const [rows] = await pool.execute<any[]>(
        `SELECT ots.titulo AS tipo_servico_titulo
         FROM grupopll_master.os_tipo_servico AS ots
         WHERE ots.id = ?`,
        [id],
      );

      if (!rows.length) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tipo de serviço ${id} não encontrado.`,
            },
          ],
        };
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows[0], null, 2) },
        ],
      };
    },
  );

  server.tool(
    'get_status_title',
    'Retorna o titulo do status associado à um ID',
    {
      id: z
        .number()
        .int()
        .positive()
        .describe('ID do tipo de serviço em grupopll_master.setor_status'),
    },
    async ({ id }) => {
      const deny = await authorize('get_status_title');
      if (deny) return deny;

      const [rows] = await pool.execute<any[]>(
        `SELECT st.titulo AS setor_status_titulo
         FROM grupopll_master.setor_status AS st
         WHERE st.id = ?`,
        [id],
      );

      if (!rows.length) {
        return {
          content: [
            { type: 'text' as const, text: `Status ${id} não encontrado.` },
          ],
        };
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows[0], null, 2) },
        ],
      };
    },
  );
}
