import axios from 'axios';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';
import { PllApiAuthService } from '../pll-api/pll-api-auth.service';
import { TOOL_ACCESS } from './tool-access.config';
import type { McpUser, ToolContext } from '../tools/types';
import { registerWhoamiTool } from '../tools/whoami.tool';
import { registerOsTools } from '../tools/os.tool';
import { registerCmvTools } from '../tools/cmv.tool';

@Injectable()
export class McpService implements OnModuleInit {
  private cmvBaseUrl: string;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
    private readonly pllAuth: PllApiAuthService,
  ) {}

  onModuleInit() {
    this.cmvBaseUrl = `${this.config.getOrThrow<string>('B2B_BASE_URL')}/nasajon/reports/cmv`;
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

    const authorize: ToolContext['authorize'] = async (toolName) => {
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

      // Log de execução (fire-and-forget)
      this.pool
        .execute(`INSERT INTO oauth_execution_log (colaborador_id, tool_name) VALUES (?, ?)`, [user.userId, toolName])
        .catch(() => {});

      return null;
    };

    const ctx: ToolContext = { server, user, pool: this.pool, authorize };

    registerWhoamiTool(ctx);
    registerOsTools(ctx);
    registerCmvTools(ctx, this.fetchCmvReport.bind(this));

    return server;
  }
}
