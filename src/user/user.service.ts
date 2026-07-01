import { Inject, Injectable } from '@nestjs/common';
import { compare } from 'bcrypt';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';

export interface AuthUser {
  id: string;
  email: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  active: number;
}

@Injectable()
export class UserService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<AuthUser | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, email, password_hash, active FROM users WHERE email = ? LIMIT 1',
      [username],
    );

    const user = rows[0];
    if (!user || !user.active) return null;

    const match = await compare(password, user.password_hash);
    if (!match) return null;

    return { id: String(user.id), email: user.email };
  }
}
