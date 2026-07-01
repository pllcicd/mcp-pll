import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ToolContext } from './types';

const escopoParam = z
  .enum(['LEITURA', 'USO'])
  .describe('Código do escopo: LEITURA ou USO');

/**
 * Ferramentas de administração do RBAC (mcp_ferramentas / mcp_escopos /
 * mcp_ferramentas_escopo / mcp_perfis_escopo). Gate-adas por USO como qualquer
 * outra ferramenta — o perfil ADMIN recebe USO nelas via o seed de bootstrap em
 * schema.sql, o que resolve o ovo-galinha de quem administra o próprio RBAC.
 * Toda escrita grava fk_colaborador = usuário autenticado, alimentando os
 * triggers de versionamento (tabelas *_log).
 */
export function registerAdminTools({
  server,
  user,
  pool,
  authorize,
}: ToolContext) {
  server.tool(
    'admin_register_tool',
    'Cadastra ou atualiza uma ferramenta no registro RBAC (mcp_ferramentas)',
    {
      nome: z
        .string()
        .min(1)
        .describe('Nome interno da ferramenta (casa com server.tool)'),
      arquivo_fonte: z
        .string()
        .min(1)
        .describe('Caminho relativo a src/tools/, ex.: os.tool.ts'),
      descricao: z.string().optional().describe('Descrição da ferramenta'),
    },
    async ({ nome, arquivo_fonte, descricao }) => {
      const deny = await authorize('admin_register_tool');
      if (deny) return deny;

      await pool.execute(
        `INSERT INTO mcp_ferramentas (nome, descricao, arquivo_fonte, fk_colaborador)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           descricao      = VALUES(descricao),
           arquivo_fonte  = VALUES(arquivo_fonte),
           fk_colaborador = VALUES(fk_colaborador),
           cancelado      = NULL`,
        [nome, descricao ?? '', arquivo_fonte, user.userId],
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: `Ferramenta "${nome}" registrada com sucesso.`,
          },
        ],
      };
    },
  );

  server.tool(
    'admin_link_tool_scope',
    'Vincula um escopo (LEITURA/USO) a uma ferramenta (mcp_ferramentas_escopo)',
    {
      tool_nome: z.string().min(1).describe('Nome da ferramenta'),
      escopo_codigo: escopoParam,
    },
    async ({ tool_nome, escopo_codigo }) => {
      const deny = await authorize('admin_link_tool_scope');
      if (deny) return deny;

      const [ferramentaRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM mcp_ferramentas WHERE nome = ? AND cancelado IS NULL LIMIT 1`,
        [tool_nome],
      );
      const [escopoRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM mcp_escopos WHERE codigo = ? AND cancelado IS NULL LIMIT 1`,
        [escopo_codigo],
      );

      if (!ferramentaRows[0] || !escopoRows[0]) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Ferramenta "${tool_nome}" ou escopo "${escopo_codigo}" não encontrado.`,
            },
          ],
        };
      }

      await pool.execute(
        `INSERT INTO mcp_ferramentas_escopo (fk_ferramenta, fk_escopo, fk_colaborador)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE fk_colaborador = VALUES(fk_colaborador), cancelado = NULL`,
        [ferramentaRows[0].id, escopoRows[0].id, user.userId],
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: `Escopo "${escopo_codigo}" vinculado à ferramenta "${tool_nome}".`,
          },
        ],
      };
    },
  );

  server.tool(
    'admin_grant_perfil_scope',
    'Concede a um perfil o escopo (LEITURA/USO) de uma ferramenta (mcp_perfis_escopo)',
    {
      perfil_codigo: z
        .string()
        .min(1)
        .describe('Código do perfil (chave de acesso_perfil)'),
      tool_nome: z.string().min(1).describe('Nome da ferramenta'),
      escopo_codigo: escopoParam,
    },
    async ({ perfil_codigo, tool_nome, escopo_codigo }) => {
      const deny = await authorize('admin_grant_perfil_scope');
      if (deny) return deny;

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT fe.id
           FROM mcp_ferramentas_escopo fe
           JOIN mcp_ferramentas f ON f.id = fe.fk_ferramenta AND f.cancelado IS NULL
           JOIN mcp_escopos e     ON e.id = fe.fk_escopo     AND e.cancelado IS NULL
          WHERE f.nome = ? AND e.codigo = ? AND fe.cancelado IS NULL
          LIMIT 1`,
        [tool_nome, escopo_codigo],
      );

      if (!rows[0]) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Vínculo ferramenta/escopo "${tool_nome}:${escopo_codigo}" não encontrado — cadastre-o antes com admin_link_tool_scope.`,
            },
          ],
        };
      }

      await pool.execute(
        `INSERT INTO mcp_perfis_escopo (perfil_codigo, fk_ferramenta_escopo, fk_colaborador)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE fk_colaborador = VALUES(fk_colaborador), cancelado = NULL`,
        [perfil_codigo, rows[0].id, user.userId],
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: `Perfil "${perfil_codigo}" ganhou o escopo "${escopo_codigo}" em "${tool_nome}".`,
          },
        ],
      };
    },
  );

  server.tool(
    'admin_revoke_perfil_scope',
    'Revoga (soft-delete) o escopo (LEITURA/USO) de uma ferramenta concedido a um perfil',
    {
      perfil_codigo: z
        .string()
        .min(1)
        .describe('Código do perfil (chave de acesso_perfil)'),
      tool_nome: z.string().min(1).describe('Nome da ferramenta'),
      escopo_codigo: escopoParam,
    },
    async ({ perfil_codigo, tool_nome, escopo_codigo }) => {
      const deny = await authorize('admin_revoke_perfil_scope');
      if (deny) return deny;

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE mcp_perfis_escopo pe
           JOIN mcp_ferramentas_escopo fe ON fe.id = pe.fk_ferramenta_escopo
           JOIN mcp_ferramentas f         ON f.id  = fe.fk_ferramenta
           JOIN mcp_escopos e             ON e.id  = fe.fk_escopo
            SET pe.cancelado = NOW(), pe.fk_colaborador = ?
          WHERE pe.perfil_codigo = ? AND f.nome = ? AND e.codigo = ? AND pe.cancelado IS NULL`,
        [user.userId, perfil_codigo, tool_nome, escopo_codigo],
      );

      if (!result.affectedRows) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Nenhuma concessão ativa de "${tool_nome}:${escopo_codigo}" para o perfil "${perfil_codigo}".`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Escopo "${escopo_codigo}" de "${tool_nome}" revogado do perfil "${perfil_codigo}".`,
          },
        ],
      };
    },
  );

  server.tool(
    'admin_list_grants',
    'Lista as concessões RBAC atuais (mcp_perfis_escopo), opcionalmente filtrando por perfil',
    {
      perfil_codigo: z
        .string()
        .optional()
        .describe('Filtra por um código de perfil específico'),
    },
    async ({ perfil_codigo }) => {
      const deny = await authorize('admin_list_grants');
      if (deny) return deny;

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT pe.perfil_codigo, f.nome AS ferramenta, e.codigo AS escopo, pe.adicionado
           FROM mcp_perfis_escopo pe
           JOIN mcp_ferramentas_escopo fe ON fe.id = pe.fk_ferramenta_escopo
           JOIN mcp_ferramentas f         ON f.id  = fe.fk_ferramenta
           JOIN mcp_escopos e             ON e.id  = fe.fk_escopo
          WHERE pe.cancelado IS NULL
            ${perfil_codigo ? 'AND pe.perfil_codigo = ?' : ''}
          ORDER BY pe.perfil_codigo, f.nome, e.codigo`,
        perfil_codigo ? [perfil_codigo] : [],
      );

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(rows, null, 2) },
        ],
      };
    },
  );
}
