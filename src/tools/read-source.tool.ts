import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { RowDataPacket } from 'mysql2/promise';
import type { ToolContext } from './types';

// Raiz dos fontes .ts das ferramentas. Em runtime (dist/) __dirname aponta para
// dist/tools, mas os fontes .ts vivem em src/tools — por isso resolvemos a partir
// da raiz do repo (process.cwd()), com override opcional via SOURCE_ROOT.
const TOOLS_DIR = path.resolve(
  process.env.SOURCE_ROOT ?? process.cwd(),
  'src/tools',
);

interface FerramentaRow extends RowDataPacket {
  arquivo_fonte: string | null;
}

export function registerReadSourceTool({
  server,
  pool,
  authorize,
  hasScope,
}: ToolContext) {
  server.tool(
    'read_tool_source',
    'Lê o código-fonte .ts de uma ferramenta MCP registrada, se o usuário tiver o escopo LEITURA dela',
    {
      tool_name: z
        .string()
        .min(1)
        .describe('Nome interno da ferramenta cujo código-fonte será lido'),
    },
    async ({ tool_name }) => {
      const deny = await authorize('read_tool_source');
      if (deny) return deny;

      if (!hasScope(tool_name, 'LEITURA')) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Acesso negado: você não possui o escopo LEITURA para a ferramenta "${tool_name}".`,
            },
          ],
          isError: true,
        };
      }

      const [rows] = await pool.execute<FerramentaRow[]>(
        `SELECT arquivo_fonte FROM mcp_ferramentas WHERE nome = ? AND cancelado IS NULL LIMIT 1`,
        [tool_name],
      );

      const arquivoFonte = rows[0]?.arquivo_fonte;
      if (!arquivoFonte) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Ferramenta "${tool_name}" não encontrada no registro.`,
            },
          ],
        };
      }

      // Guarda contra path traversal: caminho não pode ser absoluto, conter '..'
      // e o resultado resolvido deve permanecer dentro de TOOLS_DIR.
      if (
        path.isAbsolute(arquivoFonte) ||
        arquivoFonte.split(/[\\/]/).includes('..')
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Caminho de código-fonte inválido para "${tool_name}".`,
            },
          ],
          isError: true,
        };
      }

      const fullPath = path.resolve(TOOLS_DIR, arquivoFonte);
      if (
        fullPath !== TOOLS_DIR &&
        !fullPath.startsWith(TOOLS_DIR + path.sep)
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Caminho de código-fonte inválido para "${tool_name}".`,
            },
          ],
          isError: true,
        };
      }

      try {
        const code = await fs.readFile(fullPath, 'utf8');
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { tool: tool_name, arquivo_fonte: arquivoFonte, code },
                null,
                2,
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Arquivo de código-fonte de "${tool_name}" não encontrado em disco.`,
            },
          ],
        };
      }
    },
  );
}
