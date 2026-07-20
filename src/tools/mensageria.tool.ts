import { z } from 'zod';
import type { ToolContext } from './types';

type BypassWhatsappSent = (id: number) => Promise<unknown>;

export function registerMensageriaTools(
  ctx: ToolContext,
  bypassWhatsappSent: BypassWhatsappSent,
) {
  const { server, authorize } = ctx;

  server.tool(
    'bypass_whatsapp_sent',
    'Reenvia forçadamente um item da fila whatsapp_sent para o cliente, ' +
      'sobrescrevendo a validação de badlist/blacklist e ignorando eventual ' +
      'erro já registrado na mensagem. Ação sensível: usar apenas quando o ' +
      'reenvio manual for explicitamente solicitado.',
    {
      id: z
        .number()
        .int()
        .positive()
        .describe('ID do registro em whatsapp_sent a ser reenviado'),
    },
    {
      title: 'Bypass de envio WhatsApp (força reenvio)',
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ id }) => {
      const deny = await authorize('bypass_whatsapp_sent');
      if (deny) return deny;

      try {
        const result = await bypassWhatsappSent(id);
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Erro ao forçar reenvio do id ${id}: ${err.response?.data?.message ?? err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
