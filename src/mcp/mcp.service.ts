import axios from 'axios';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';
import { PllApiAuthService } from '../pll-api/pll-api-auth.service';
import type { HasScopeFn, McpUser, ToolContext } from '../tools/types';
import { registerWhoamiTool } from '../tools/whoami.tool';
import { registerOsTools } from '../tools/os.tool';
import { registerCmvTools } from '../tools/cmv.tool';
import { registerReadSourceTool } from '../tools/read-source.tool';
import { registerAdminTools } from '../tools/admin.tool';
import { registerColaboradorTools } from '../tools/colaborador.tool';
import { registerSchemaTools } from '../tools/schema.tool';
import { registerGithubTools } from '../tools/github.tool';
import { registerMensageriaTools } from '../tools/mensageria.tool';
import { registerGitTools } from '../tools/git.tool';

@Injectable()
export class McpService implements OnModuleInit {
  private cmvBaseUrl: string;
  private mensageriaBaseUrl: string;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
    private readonly pllAuth: PllApiAuthService,
  ) {
    this.cmvBaseUrl = '';
    this.mensageriaBaseUrl = '';
  }

  onModuleInit() {
    const apiUrl = this.config.getOrThrow<string>('GRUPOPLL_API_URL');
    this.cmvBaseUrl = `${apiUrl}/nasajon/reports/cmv`;
    this.mensageriaBaseUrl = `${apiUrl}/sac/notificacoes/message`;
  }

  private async fetchCmvReport(
    path: string,
    database: string,
    forceRefresh?: boolean,
  ): Promise<{ url: string; expiresAt: string }> {
    const token = await this.pllAuth.getToken();
    const response = await axios.get<{ url: string; expiresAt: string }>(
      `${this.cmvBaseUrl}/${path}`,
      {
        params: { database, ...(forceRefresh ? { forceRefresh } : {}) },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  private async bypassWhatsappSent(id: number): Promise<unknown> {
    const token = await this.pllAuth.getToken();
    const response = await axios.post(
      `${this.mensageriaBaseUrl}/process-single-force`,
      { id },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }

  createServer(user: McpUser) {
    const instructions = [
      'Se o usuário pedir algo que nenhuma ferramenta disponível nesta sessão consegue',
      'atender (ex.: um dado ou uma ação que não existe em nenhuma tool do tools/list',
      'atual), não invente a resposta nem finja ter concluído a tarefa: diga',
      'explicitamente o que faltou. Em seguida, monte e chame a ferramenta',
      'create_github_issue (repo "mcp-pll" por padrão) sugerindo a nova ferramenta:',
      'inclua no corpo o colaborador/cliente envolvido, a solicitação original, o que',
      'foi tentado e a sugestão de ferramenta (nome em snake_case, parâmetros, lógica).',
      'Confirme com o usuário antes de abrir a issue.',
    ].join(' ');

    const server = new McpServer(
      { name: 'mcp-pll', version: '1.0.0' },
      { instructions },
    );

    // Concessões resolvidas em mcp_perfis_escopo e embutidas no JWT (claim `scope`).
    // Lookup em memória — nenhuma consulta ao banco por chamada de tool.
    const grantSet = new Set(
      user.grants.map((g) => `${g.ferramenta}:${g.escopo}`),
    );
    const hasScope: HasScopeFn = (ferramenta, escopo) =>
      grantSet.has(`${ferramenta}:${escopo}`);

    const authorize: ToolContext['authorize'] = async (toolName) => {
      if (!hasScope(toolName, 'USO')) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Acesso negado: você não possui o escopo USO para a ferramenta "${toolName}".`,
            },
          ],
          isError: true,
        };
      }

      // Log de execução (fire-and-forget)
      this.pool
        .execute(
          `INSERT INTO oauth_execution_log (colaborador_id, tool_name) VALUES (?, ?)`,
          [user.userId, toolName],
        )
        .catch(() => {});

      return null;
    };

    // Ferramentas sem o escopo USO são desabilitadas logo após o registro: somem
    // do tools/list e o SDK rejeita chamadas diretas — `authorize` acima é a
    // segunda camada de defesa caso alguma ferramenta seja registrada fora deste wrapper.
    const scopedServer = new Proxy(server, {
      get(target, prop, receiver) {
        if (prop === 'tool') {
          // `.bind` sobre um método com múltiplas sobrecargas (as várias
          // assinaturas de `server.tool`) perde a tipagem forte e cai em
          // `any` — limitação conhecida do TS, não deste código.
          const toolFn = target.tool.bind(target);
          return (...args: unknown[]): RegisteredTool => {
            const toolName = args[0] as string;
            const registered: RegisteredTool = toolFn(...args);
            if (!hasScope(toolName, 'USO')) {
              registered.disable();
            }
            return registered;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const ctx: ToolContext = {
      server: scopedServer,
      user,
      pool: this.pool,
      authorize,
      hasScope,
    };

    registerWhoamiTool(ctx);
    registerOsTools(ctx);
    registerCmvTools(ctx, this.fetchCmvReport.bind(this));
    registerReadSourceTool(ctx);
    registerAdminTools(ctx);
    registerColaboradorTools(ctx);
    registerSchemaTools(ctx);
    registerGithubTools(ctx);
    registerMensageriaTools(ctx, this.bypassWhatsappSent.bind(this));
    registerGitTools(ctx);

    return server;
  }
}
