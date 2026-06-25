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
      secretOrKeyProvider: (_req: any, _token: any, done: (e: any, k?: any) => void) => {
        done(null, keysService.getPublicKeyPem());
      },
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      audience: publicUrl,
      issuer: publicUrl,
    });
  }

  async validate(payload: any) {
    return {
      userId:   payload.sub,
      email:    payload.email,
      nome:     payload.nome ?? '',
      profiles: typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [],
    };
  }
}
