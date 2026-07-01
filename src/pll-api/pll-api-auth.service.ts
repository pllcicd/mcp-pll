import axios from 'axios';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PllApiAuthService implements OnModuleInit {
  private readonly logger = new Logger(PllApiAuthService.name);

  private token: string | null = null;
  private expiresAt: number | null = null;

  private apiUrl: string;
  private username: string;
  private password: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.apiUrl = this.config.getOrThrow<string>('GRUPOPLL_API_URL');
    this.username = this.config.getOrThrow<string>('GRUPOPLL_USERNAME');
    this.password = this.config.getOrThrow<string>('GRUPOPLL_PASSWORD');
  }

  private async authenticate(): Promise<void> {
    const response = await axios.post<Record<string, unknown>>(
      `${this.apiUrl}/auth/login`,
      { username: this.username, password: this.password },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const token = (response.data.access_token ?? response.data.token) as
      | string
      | undefined;
    if (!token) throw new Error('Resposta de /auth/login não contém token');

    this.token = token;
    this.expiresAt = this.parseExp(token) ?? Date.now() + 23 * 60 * 60 * 1000;
    this.logger.log('Token Grupo PLL renovado');
  }

  /** Retorna o token JWT pronto para uso nas APIs do Grupo PLL. */
  async getToken(): Promise<string> {
    if (!this.token || !this.expiresAt || Date.now() >= this.expiresAt) {
      await this.authenticate();
    }
    return this.token!;
  }

  private parseExp(jwt: string): number | null {
    try {
      const payload = JSON.parse(
        Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'),
      );
      if (typeof payload.exp === 'number') {
        return (payload.exp - 60) * 1000; // 60s de buffer
      }
    } catch {
      // JWT mal-formado — usa TTL padrão
    }
    return null;
  }
}
