import axios from 'axios';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { DB_POOL } from '../database/database.module';
import { PllApiAuthService } from '../pll-api/pll-api-auth.service';
import { TOOL_ACCESS } from './tool-access.config';

type McpUser = {
  userId: string;
  email: string;
  nome: string;
  profiles: string[];
};

@Injectable()
export class McpService implements OnModuleInit {
  private cmvBaseUrl: string;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
    private readonly pllAuth: PllApiAuthService,
  ) {}

  onModuleInit() {
    // this.cmvBaseUrl = `${this.config.getOrThrow<string>('GRUPOPLL_API_URL')}/nasajon/reports/cmv`;
    this.cmvBaseUrl = `http://localhost:3001/nasajon/reports/cmv`;
  }

  private async fetchCmvReport(path: string, database: string): Promise<{ url: string; expiresAt: string }> {
    const token = await this.pllAuth.getToken();
    const response = await axios.get<{ url: string; expiresAt: string }>(
      `${this.cmvBaseUrl}/${path}`,
      { params: { database }, headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }

  createServer(user: McpUser) {
    const server = new McpServer({ name: 'mcp-pll', version: '1.0.0' });

    /** Verifica perfis e loga a execução. Retorna null se autorizado, ou um objeto de erro MCP. */
    const authorize = async (toolName: string) => {
      const access = TOOL_ACCESS[toolName] ?? { profiles: [], mode: 'any' };

      if (access.profiles.length > 0) {
        const granted =
          access.mode === 'any'
            ? access.profiles.some((p) => user.profiles.includes(p))
            : access.profiles.every((p) => user.profiles.includes(p));

        if (!granted) {
          const requirement =
            access.mode === 'any'
              ? `um dos perfis: ${access.profiles.join(', ')}`
              : `todos os perfis: ${access.profiles.join(', ')}`;
          return {
            content: [{ type: 'text' as const, text: `Acesso negado: "${toolName}" requer ${requirement}.` }],
            isError: true,
          };
        }
      }

      // Log de execução (fire-and-forget — não bloqueia a resposta)
      this.pool
        .execute(`INSERT INTO oauth_execution_log (colaborador_id, tool_name) VALUES (?, ?)`, [user.userId, toolName])
        .catch(() => {});

      return null;
    };

    server.tool(
      'whoami',
      'Returns the authenticated user info from the JWT',
      async () => {
        const deny = await authorize('whoami');
        if (deny) return deny;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { userId: user.userId, email: user.email, nome: user.nome, profiles: user.profiles },
                null,
                2,
              ),
            },
          ],
        };
      },
    );


    server.tool(
      'get_os',
      'Retorna todos os dados brutos de uma OS',
      { id: z.number().int().positive().describe('ID da OS em grupopll_crmoema.os') },
      async ({ id }) => {
        const deny = await authorize('get_os');
        if (deny) return deny;

        const [rows] = await this.pool.execute<any[]>(
          `SELECT os.*
           FROM grupopll_crmoema.os os
           WHERE os.id = ?`,
          [id],
        );

        if (!rows.length) {
          return { content: [{ type: 'text', text: `OS ${id} não encontrada.` }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
      },
    );


    server.tool(
      'get_service_title',
      'Retorna o tipo de serviço associado à um ID',
      { id: z.number().int().positive().describe('ID do tipo de serviço em grupopll_master.os_tipo_servico') },
      async ({ id }) => {
        const deny = await authorize('get_service_title');
        if (deny) return deny;

        const [rows] = await this.pool.execute<any[]>(
          `SELECT ots.titulo AS tipo_servico_titulo
           FROM grupopll_master.os_tipo_servico AS ots
           WHERE ots.id = ?`,
          [id],
        );

        if (!rows.length) {
          return { content: [{ type: 'text', text: `OS ${id} não encontrada.` }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
      },
    );

    server.tool(
      'get_status_title',
      'Retorna o titulo do status associado à um ID',
      { id: z.number().int().positive().describe('ID do tipo de serviço em grupopll_master.setor_status') },
      async ({ id }) => {
        const deny = await authorize('get_status_title');
        if (deny) return deny;

        const [rows] = await this.pool.execute<any[]>(
          `SELECT st.titulo AS setor_status_titulo
           FROM grupopll_master.setor_status AS st
           WHERE st.id = ?`,
          [id],
        );

        if (!rows.length) {
          return { content: [{ type: 'text', text: `OS ${id} não encontrada.` }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }] };
      },
    );

    const dbParam = { database: z.string().optional().describe('Banco da empresa (padrão: crmoema)') };

    const cmvTool = async (toolName: string, path: string, database = 'crmoema') => {
      const deny = await authorize(toolName);
      if (deny) return deny;
      const result = await this.fetchCmvReport(path, database);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    };

    server.tool(
      'cmv_parts_rupture_analysis',
      'Gera o relatório de Análise de Ruptura de Peças (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
      dbParam,
      ({ database }) => cmvTool('cmv_parts_rupture_analysis', 'parts-rupture-analysis', database),
    );

    server.tool(
      'cmv_parts_consumption_physical_match',
      'Gera o relatório de Consumo de Peças Casadas Fisicamente (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
      dbParam,
      ({ database }) => cmvTool('cmv_parts_consumption_physical_match', 'parts-consumption-physical-match', database),
    );

    server.tool(
      'cmv_parts_consumption_systemic_match',
      'Gera o relatório de Consumo de Peças Casadas Sistemicamente (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
      dbParam,
      ({ database }) => cmvTool('cmv_parts_consumption_systemic_match', 'parts-consumption-systemic-match', database),
    );

    server.tool(
      'cmv_parts_consumption_awaiting_match',
      'Gera o relatório de Consumo de Peças Aguardando Casamento (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
      dbParam,
      ({ database }) => cmvTool('cmv_parts_consumption_awaiting_match', 'parts-consumption-awaiting-match', database),
    );

    server.tool(
      'cmv_parts_operational_loss',
      'Gera o relatório de Perda Operacional de Peças (CMV) e retorna um link de download (.xlsx) válido por tempo limitado.',
      dbParam,
      ({ database }) => cmvTool('cmv_parts_operational_loss', 'parts-operational-loss', database),
    );

    return server;
  }
}
