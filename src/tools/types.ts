import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'mysql2/promise';

export type Escopo = 'LEITURA' | 'USO';

/** Concessão resolvida no momento da emissão do token: ferramenta + escopo concedido. */
export type ToolGrant = {
  ferramenta: string;
  escopo: Escopo;
};

export type McpUser = {
  userId: string;
  /** jti do access_token JWT — usado para vincular a sessão MCP ao token e permitir revogação em cascata. */
  jti?: string;
  email: string;
  nome: string;
  /** Perfis crus (chaves true de acesso_perfil) — usado para exibição e gates de admin. */
  profiles: string[];
  /** Concessões ferramenta:escopo resolvidas via mcp_perfis_escopo, embutidas no JWT. */
  grants: ToolGrant[];
};

export type AuthorizeFn = (toolName: string) => Promise<null | {
  content: [{ type: 'text'; text: string }];
  isError: true;
}>;

/** Verifica, em memória (sem hit ao banco), se o usuário tem o escopo dado para a ferramenta. */
export type HasScopeFn = (ferramenta: string, escopo: Escopo) => boolean;

export type ToolContext = {
  server: McpServer;
  user: McpUser;
  pool: Pool;
  authorize: AuthorizeFn;
  hasScope: HasScopeFn;
};
