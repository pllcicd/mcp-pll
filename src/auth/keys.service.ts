import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, createPublicKey } from 'crypto';
import { exportJWK, exportSPKI, generateKeyPair, importPKCS8, importSPKI } from 'jose';
import type { CryptoKey } from 'jose';

@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private privateKey: CryptoKey;
  private publicKey: CryptoKey;
  private publicKeyPem: string;
  private jwksPayload: object;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const privateB64 = this.config.get<string>('JWT_PRIVATE_KEY_B64');
    const publicB64 = this.config.get<string>('JWT_PUBLIC_KEY_B64');

    if (privateB64 && publicB64) {
      const privatePem = Buffer.from(privateB64, 'base64').toString('utf8');
      const publicPem = Buffer.from(publicB64, 'base64').toString('utf8');

      // Node.js crypto aceita PKCS#1 e PKCS#8; normaliza para o formato que o jose exige
      const pkcs8Pem = createPrivateKey(privatePem)
        .export({ type: 'pkcs8', format: 'pem' }) as string;
      const spkiPem = createPublicKey(publicPem)
        .export({ type: 'spki', format: 'pem' }) as string;

      this.privateKey = await importPKCS8(pkcs8Pem, 'RS256');
      this.publicKey = await importSPKI(spkiPem, 'RS256');
      this.logger.log('RSA key pair loaded from environment');
    } else {
      this.logger.warn(
        'JWT_PRIVATE_KEY_B64 not set — generating ephemeral key pair (tokens are invalidated on restart)',
      );
      const pair = await generateKeyPair('RS256');
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
    }

    this.publicKeyPem = await exportSPKI(this.publicKey);

    const jwk = await exportJWK(this.publicKey);
    this.jwksPayload = {
      keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: 'default' }],
    };
  }

  getPrivateKey(): CryptoKey {
    return this.privateKey;
  }

  getPublicKeyPem(): string {
    return this.publicKeyPem;
  }

  getJwks(): object {
    return this.jwksPayload;
  }
}
