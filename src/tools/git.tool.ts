import { z } from 'zod';
import type { ToolContext } from './types';

export function registerGitTools({ server, pool, authorize }: ToolContext) {
  server.tool(
    'git_projeto_salvar',
    'Cadastra ou atualiza um projeto git (identificado pela URL do remote)',
    {
      nome: z
        .string()
        .min(1)
        .describe('Nome amigável do projeto'),
      remote_url: z
        .string()
        .min(1)
        .describe('URL do remote do projeto, ex.: github.com/org/repo'),
    },
    async ({ nome, remote_url }) => {
      const deny = await authorize('git_projeto_salvar');
      if (deny) return deny;

      await pool.execute(
        `INSERT INTO ai_mcp.git_projetos (nome, remote_url)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE nome = VALUES(nome)`,
        [nome, remote_url],
      );

      const [rows] = await pool.execute<any[]>(
        `SELECT * FROM ai_mcp.git_projetos WHERE remote_url = ?`,
        [remote_url],
      );

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows[0], null, 2) },
        ],
      };
    },
  );

  server.tool(
    'git_projeto_listar',
    'Lista os projetos git cadastrados',
    async () => {
      const deny = await authorize('git_projeto_listar');
      if (deny) return deny;

      const [rows] = await pool.execute<any[]>(
        `SELECT * FROM ai_mcp.git_projetos ORDER BY nome`,
      );

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );

  server.tool(
    'git_referencia_salvar',
    'Registra que um local exato (arquivo/linhas) em um projeto git depende de um local exato em outro projeto git, para navegação direta sem reexplorar nenhum dos dois repositórios',
    {
      projeto_id_origem: z
        .number()
        .int()
        .positive()
        .describe('ID do projeto de origem (quem depende) em ai_mcp.git_projetos'),
      caminho_origem: z
        .string()
        .min(1)
        .describe('Caminho do arquivo no projeto de origem, relativo ao root do projeto'),
      linha_inicio_origem: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Linha inicial do trecho referenciado na origem'),
      linha_fim_origem: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Linha final do trecho referenciado na origem'),
      identificador_origem: z
        .string()
        .optional()
        .describe('Nome da função/ferramenta/trecho que depende do destino, ex.: "cmv_parts_rupture_analysis"'),
      projeto_id_destino: z
        .number()
        .int()
        .positive()
        .describe('ID do projeto de destino (onde o código vive) em ai_mcp.git_projetos'),
      caminho_destino: z
        .string()
        .min(1)
        .describe('Caminho do arquivo no projeto de destino, relativo ao root do projeto'),
      linha_inicio_destino: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Linha inicial do trecho referenciado no destino'),
      linha_fim_destino: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Linha final do trecho referenciado no destino'),
      identificador_destino: z
        .string()
        .optional()
        .describe('Nome do endpoint/rota/função referenciado no destino, ex.: "GET /reports/cmv/parts-rupture-analysis"'),
      descricao: z
        .string()
        .optional()
        .describe('Contexto: o que é e por que a origem depende do destino'),
    },
    async ({
      projeto_id_origem,
      caminho_origem,
      linha_inicio_origem,
      linha_fim_origem,
      identificador_origem,
      projeto_id_destino,
      caminho_destino,
      linha_inicio_destino,
      linha_fim_destino,
      identificador_destino,
      descricao,
    }) => {
      const deny = await authorize('git_referencia_salvar');
      if (deny) return deny;

      const [projetos] = await pool.execute<any[]>(
        `SELECT id FROM ai_mcp.git_projetos WHERE id IN (?, ?)`,
        [projeto_id_origem, projeto_id_destino],
      );
      const encontrados = new Set(projetos.map((p) => p.id));
      if (!encontrados.has(projeto_id_origem) || !encontrados.has(projeto_id_destino)) {
        const faltando = [projeto_id_origem, projeto_id_destino].filter(
          (id) => !encontrados.has(id),
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `Projeto(s) não encontrado(s): ${faltando.join(', ')}.`,
            },
          ],
        };
      }

      const [result] = await pool.execute<any>(
        `INSERT INTO ai_mcp.git_referencias
           (fk_projeto_origem, caminho_origem, linha_inicio_origem, linha_fim_origem, identificador_origem,
            fk_projeto_destino, caminho_destino, linha_inicio_destino, linha_fim_destino, identificador_destino,
            descricao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projeto_id_origem,
          caminho_origem,
          linha_inicio_origem ?? null,
          linha_fim_origem ?? null,
          identificador_origem ?? null,
          projeto_id_destino,
          caminho_destino,
          linha_inicio_destino ?? null,
          linha_fim_destino ?? null,
          identificador_destino ?? null,
          descricao ?? '',
        ],
      );

      const [rows] = await pool.execute<any[]>(
        `SELECT * FROM ai_mcp.git_referencias WHERE id = ?`,
        [result.insertId],
      );

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows[0], null, 2) },
        ],
      };
    },
  );

  server.tool(
    'git_referencia_listar',
    'Lista as referências cruzadas cadastradas, opcionalmente filtrando por projeto de origem ou de destino',
    {
      projeto_id_origem: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Filtra pelo ID do projeto de origem em ai_mcp.git_projetos'),
      projeto_id_destino: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Filtra pelo ID do projeto de destino em ai_mcp.git_projetos'),
    },
    async ({ projeto_id_origem, projeto_id_destino }) => {
      const deny = await authorize('git_referencia_listar');
      if (deny) return deny;

      const conditions: string[] = [];
      const params: any[] = [];
      if (projeto_id_origem !== undefined) {
        conditions.push('fk_projeto_origem = ?');
        params.push(projeto_id_origem);
      }
      if (projeto_id_destino !== undefined) {
        conditions.push('fk_projeto_destino = ?');
        params.push(projeto_id_destino);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [rows] = await pool.execute<any[]>(
        `SELECT * FROM ai_mcp.git_referencias ${where} ORDER BY fk_projeto_origem, caminho_origem`,
        params,
      );

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );
}
