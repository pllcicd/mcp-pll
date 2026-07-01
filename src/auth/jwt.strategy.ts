import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { KeysService } from './keys.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(keysService: KeysService, config: ConfigService) {
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
