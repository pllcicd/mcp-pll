import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Pool } from 'mysql2/promise';

export type McpUser = {
  userId: string;
  email: string;
  nome: string;
  profiles: string[];
};

export type AuthorizeFn = (
  toolName: string,
) => Promise<null | { content: [{ type: 'text'; text: string }]; isError: true }>;

export type ToolContext = {
  server: McpServer;
  user: McpUser;
  pool: Pool;
  authorize: AuthorizeFn;
};
