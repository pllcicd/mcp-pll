import { Inject, Injectable } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';
import type { ToolGrant } from '../tools/types';

interface GrantRow extends RowDataPacket {
  ferramenta: string;
  escopo: 'LEITURA' | 'USO';
}

/**
 * Resolve os perfis de um colaborador (chaves true de acesso_perfil) para as
 * concessões ferramenta+escopo definidas em mcp_perfis_escopo. Chamado uma
 * única vez por emissão/renovação de token — o resultado é embutido no JWT,
 * então `authorize()` não precisa de acesso ao banco por chamada de tool.
 */
@Injectable()
export class ScopeService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async resolveGrants(perfis: string[]): Promise<ToolGrant[]> {
    if (perfis.length === 0) return [];

    const placeholders = perfis.map(() => '?').join(', ');
    const [rows] = await this.pool.query<GrantRow[]>(
      `SELECT DISTINCT f.nome AS ferramenta, e.codigo AS escopo
         FROM mcp_perfis_escopo pe
         JOIN mcp_ferramentas_escopo fe ON fe.id = pe.fk_ferramenta_escopo AND fe.cancelado IS NULL
         JOIN mcp_ferramentas f         ON f.id  = fe.fk_ferramenta        AND f.cancelado  IS NULL
         JOIN mcp_escopos e             ON e.id  = fe.fk_escopo            AND e.cancelado  IS NULL
        WHERE pe.perfil_codigo IN (${placeholders})
          AND pe.cancelado IS NULL`,
      perfis,
    );

    return rows.map((r) => ({ ferramenta: r.ferramenta, escopo: r.escopo }));
  }
}
