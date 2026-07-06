import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { KeysService } from './keys.service';
import { DB_POOL } from '../database/database.module';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    keysService: KeysService,
    config: ConfigService,
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {
    const publicUrl = config.getOrThrow<string>('PUBLIC_URL');

    super({
      // Called per-request — by then KeysService.onModuleInit() has already run
      secretOrKeyProvider: (
        _req: any,
        _token: any,
        done: (e: any, k?: any) => void,
      ) => {
        done(null, keysService.getPublicKeyPem());
      },
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      audience: publicUrl,
      issuer: publicUrl,
    });
  }

  async validate(payload: any) {
    // Verifica revogação no banco — a assinatura/exp do JWT sozinha não reflete
    // um logout ou revogação manual feita via UPDATE oauth_tokens SET revoked=1.
    if (payload.jti) {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT revoked FROM oauth_tokens WHERE access_jti = ? LIMIT 1`,
        [payload.jti],
      );
      const row = rows[0];
      if (row?.revoked) {
        throw new UnauthorizedException('Token revogado');
      }
    }

    // claim `scope`: concessões "ferramenta:ESCOPO" (ex.: "whoami:USO get_os:LEITURA").
    const grants =
      typeof payload.scope === 'string'
        ? payload.scope
            .split(' ')
            .filter(Boolean)
            .map((entry: string) => {
              const i = entry.lastIndexOf(':');
              return {
                ferramenta: entry.slice(0, i),
                escopo: entry.slice(i + 1),
              };
            })
        : [];

    return {
      userId: payload.sub,
      jti: payload.jti,
      email: payload.email,
      nome: payload.nome ?? '',
      // claim `profiles`: perfis crus (chaves true de acesso_perfil).
      profiles:
        typeof payload.profiles === 'string'
          ? payload.profiles.split(' ').filter(Boolean)
          : [],
      grants,
    };
  }
}
