import { z } from 'zod';
import type { ToolContext } from './types';

type FetchCmvReport = (
  path: string,
  database: string,
  forceRefresh?: boolean,
) => Promise<{ url: string; expiresAt: string }>;

const dbParam = {
  database: z
    .string()
    .optional()
    .describe('Banco da empresa (padrão: crmoema)'),
  forceRefresh: z
    .boolean()
    .optional()
    .describe(
      'Força a regeração do relatório ignorando cache (padrão: false). Usar apenas true se o usuário pedir explicitamente.',
    ),
};

const readOnlyAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

export function registerCmvTools(
  ctx: ToolContext,
  fetchCmvReport: FetchCmvReport,
) {
  const { server, authorize } = ctx;

  const cmvTool = async (
    toolName: string,
    path: string,
    database = 'crmoema',
    forceRefresh?: boolean,
  ) => {
    const deny = await authorize(toolName);
    if (deny) return deny;
    const result = await fetchCmvReport(path, database, forceRefresh);
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  };

  server.tool(
    'cmv_parts_rupture_analysis',
    'Gera o relatório de Análise de Ruptura de Peças (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
    dbParam,
    { title: 'Relatório: Análise de Ruptura de Peças', ...readOnlyAnnotations },
    ({ database, forceRefresh }) =>
      cmvTool(
        'cmv_parts_rupture_analysis',
        'parts-rupture-analysis',
        database,
        forceRefresh,
      ),
  );

  server.tool(
    'cmv_parts_consumption_physical_match',
    'Gera o relatório de Consumo de Peças Casadas Fisicamente (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
    dbParam,
    {
      title: 'Relatório: Consumo de Peças Casadas Fisicamente',
      ...readOnlyAnnotations,
    },
    ({ database, forceRefresh }) =>
      cmvTool(
        'cmv_parts_consumption_physical_match',
        'parts-consumption-physical-match',
        database,
        forceRefresh,
      ),
  );

  server.tool(
    'cmv_parts_consumption_systemic_match',
    'Gera o relatório de Consumo de Peças Casadas Sistemicamente (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
    dbParam,
    {
      title: 'Relatório: Consumo de Peças Casadas Sistemicamente',
      ...readOnlyAnnotations,
    },
    ({ database, forceRefresh }) =>
      cmvTool(
        'cmv_parts_consumption_systemic_match',
        'parts-consumption-systemic-match',
        database,
        forceRefresh,
      ),
  );

  server.tool(
    'cmv_parts_consumption_awaiting_match',
    'Gera o relatório de Consumo de Peças Aguardando Casamento (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
    dbParam,
    {
      title: 'Relatório: Consumo de Peças Aguardando Casamento',
      ...readOnlyAnnotations,
    },
    ({ database, forceRefresh }) =>
      cmvTool(
        'cmv_parts_consumption_awaiting_match',
        'parts-consumption-awaiting-match',
        database,
        forceRefresh,
      ),
  );

  server.tool(
    'cmv_parts_operational_loss',
    'Gera o relatório de Perda Operacional de Peças (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
    dbParam,
    { title: 'Relatório: Perda Operacional de Peças', ...readOnlyAnnotations },
    ({ database, forceRefresh }) =>
      cmvTool(
        'cmv_parts_operational_loss',
        'parts-operational-loss',
        database,
        forceRefresh,
      ),
  );

  server.tool(
    'cmv_parts_stock_hit',
    'Gera o relatório de Estoque Disponível de Peças não vinculadas a nenhum pedido (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
    dbParam,
    {
      title: 'Relatório: Estoque Disponível de Peças sem Pedido',
      ...readOnlyAnnotations,
    },
    ({ database, forceRefresh }) =>
      cmvTool('cmv_parts_stock_hit', 'parts-stock-hit', database, forceRefresh),
  );
}
