import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

export interface ISessionRes {
  /** Id do colaborador em grupopll_master.cadastro_colaborador.
   *  Ajuste o nome do campo se o B2B retornar outro key (ex.: "id", "userId", etc.) */
  colaboradorId: number;
}

@Injectable()
export class B2BService {
  private readonly axios: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.axios = axios.create({
      baseURL: this.config.getOrThrow<string>('B2B_API_URL'),
      headers: {
        Authorization: `Bearer ${this.config.getOrThrow<string>('B2B_API_TOKEN')}`,
      },
    });
  }

  async getLogin(sessionId: string): Promise<ISessionRes> {
    const response = await this.axios.get<ISessionRes>(`/session-information/${sessionId}`);
    return response.data;
  }
}
