import { Inject, Injectable } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';

export interface ColaboradorInfo {
  id: number;
  email: string;
  nome: string;
  profiles: string[];
}

/**
 * Linha retornada por grupopll_master.cadastro_colaborador.
 *
 * ATENÇÃO: ajuste os nomes das colunas abaixo para corresponder ao schema real do banco.
 *  - `email`   → coluna com o e-mail do colaborador
 *  - `nome`    → coluna com o nome completo
 *  - `modulos` → coluna (ou campo derivado) com os módulos/permissões, separados por vírgula
 *                (ex.: "vendas,financeiro,rh"). Se for JSON, ajuste o parse abaixo.
 */
interface ColaboradorRow extends RowDataPacket {
  id: number;
  email: string;
  nome: string;
  /** JSON {"crm": true, "admin": true} — chaves com true viram o array profiles */
  acesso_perfil: string | null;
}

@Injectable()
export class ColaboradorService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async getColaboradorScopes(colaboradorId: number): Promise<ColaboradorInfo> {
    const [rows] = await this.pool.execute<ColaboradorRow[]>(
      `SELECT id, email, nome, acesso_perfil
         FROM grupopll_master.cadastro_colaborador
        WHERE id = ?
        LIMIT 1`,
      [colaboradorId],
    );

    const row = rows[0];
    if (!row) {
      throw new Error(`Colaborador ${colaboradorId} não encontrado em cadastro_colaborador`);
    }

    let profiles: string[] = [];
    if (row.acesso_perfil) {
      try {
        const parsed: Record<string, unknown> = JSON.parse(row.acesso_perfil);
        profiles = Object.entries(parsed)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
      } catch {
        // acesso_perfil malformado → sem perfis
      }
    }

    return { id: row.id, email: row.email, nome: row.nome, profiles };
  }
}
