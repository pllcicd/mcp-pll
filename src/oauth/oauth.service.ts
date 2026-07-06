import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { DB_POOL } from '../database/database.module';
import { KeysService } from '../auth/keys.service';
import type { ColaboradorInfo } from '../colaborador/colaborador.service';
import type { ToolGrant } from '../tools/types';

// ── Tipos internos ──────────────────────────────────────────────────────────

interface PendingState {
  claudeRedirectUri: string;
  claudeState: string;
  expiresAt: number;
}

interface TokenRow extends RowDataPacket {
  colaborador_id: number;
  user_session_id: string;
  scopes: string; // coluna no banco — mapeada para `profiles` no retorno
}

const STATE_TTL_MS = 5 * 60 * 1000; // 5 min — tempo para o usuário fazer login no B2B
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 min — tempo para o Claude trocar o code

// ── Payload enviado pelo pll-erp dentro do HMAC code ───────────────────────

interface OAuthCodePayload {
  colaboradorId: number;
  exp: number; // Unix timestamp em segundos
  redirectUri: string; // deve bater com o redirect_uri que enviamos ao B2B
}

@Injectable()
export class OAuthService implements OnModuleInit {
  private readonly pendingStates = new Map<string, PendingState>();
  private oauthSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly keys: KeysService,
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  onModuleInit() {
    this.oauthSecret = this.config.getOrThrow<string>('OAUTH_SECRET');
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  getDiscoveryMetadata() {
    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL');
    return {
      issuer: publicUrl,
      authorization_endpoint: `${publicUrl}/oauth/authorize`,
      token_endpoint: `${publicUrl}/oauth/token`,
      registration_endpoint: `${publicUrl}/oauth/register`,
      revocation_endpoint: `${publicUrl}/oauth/revoke`,
      jwks_uri: `${publicUrl}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    };
  }

  // ─── Pending OAuth state (authorize → callback) ───────────────────────────

  /** Salva estado pendente e retorna o ourState gerado. */
  createPendingState(claudeRedirectUri: string, claudeState: string): string {
    const ourState = randomBytes(16).toString('hex');
    this.pendingStates.set(ourState, {
      claudeRedirectUri,
      claudeState,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    return ourState;
  }

  /** Valida e consome o ourState, retornando os dados do Claude originais. */
  consumePendingState(ourState: string): {
    claudeRedirectUri: string;
    claudeState: string;
  } {
    const entry = this.pendingStates.get(ourState);
    this.pendingStates.delete(ourState);

    if (!entry || Date.now() > entry.expiresAt) {
      throw new HttpException(
        {
          error: 'invalid_request',
          error_description: 'State inválido ou expirado',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      claudeRedirectUri: entry.claudeRedirectUri,
      claudeState: entry.claudeState,
    };
  }

  // ─── HMAC code verification (recebido do B2B) ─────────────────────────────

  /**
   * Verifica o code HMAC-SHA256 gerado pelo pll-erp e retorna o colaboradorId.
   * Formato: <base64url(payload_json)>.<hmac_hex>
   * Lança erro se assinatura inválida, expirado ou redirect_uri divergir.
   */
  verifyOAuthCode(code: string, callbackUri: string): number {
    const dotIndex = code.lastIndexOf('.');
    if (dotIndex === -1) {
      throw new HttpException(
        {
          error: 'invalid_grant',
          error_description: 'Formato de code inválido',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const payloadPart = code.slice(0, dotIndex);
    const sigPart = code.slice(dotIndex + 1);

    // 1. Verifica assinatura com timing-safe compare
    const expected = createHmac('sha256', this.oauthSecret)
      .update(payloadPart)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(sigPart);

    const sigOk =
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf);

    if (!sigOk) {
      throw new HttpException(
        {
          error: 'invalid_grant',
          error_description: 'Assinatura do code inválida',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Decodifica payload
    let data: OAuthCodePayload;
    try {
      data = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
    } catch {
      throw new HttpException(
        {
          error: 'invalid_grant',
          error_description: 'Payload do code inválido',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Valida expiração
    if (Math.floor(Date.now() / 1000) > data.exp) {
      throw new HttpException(
        { error: 'invalid_grant', error_description: 'Code expirado' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Valida audience (redirectUri assinado deve bater com o que enviamos ao B2B)
    if (data.redirectUri !== callbackUri) {
      throw new HttpException(
        {
          error: 'invalid_grant',
          error_description: 'redirect_uri não corresponde',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return data.colaboradorId;
  }

  // ─── Auth code (nosso — para o Claude trocar em /oauth/token) ─────────────

  async generateAuthCode(colaboradorId: number): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
    await this.pool.execute(
      `INSERT INTO oauth_auth_codes (code, colaborador_id, expires_at) VALUES (?, ?, ?)`,
      [code, colaboradorId, expiresAt],
    );
    return code;
  }

  async consumeAuthCode(code: string): Promise<number> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // SELECT ... FOR UPDATE trava a linha até o commit, evitando que duas
      // trocas concorrentes do mesmo code (ex.: retry de rede) passem ambas
      // pelo SELECT antes que o UPDATE marque `used = 1`.
      const [rows] = await conn.execute<
        (RowDataPacket & { colaborador_id: number })[]
      >(
        `SELECT colaborador_id FROM oauth_auth_codes
          WHERE code = ? AND used = 0 AND expires_at > NOW()
          LIMIT 1 FOR UPDATE`,
        [code],
      );

      const row = rows[0];
      if (!row) {
        await conn.rollback();
        throw new HttpException(
          {
            error: 'invalid_grant',
            error_description: 'Authorization code inválido ou expirado',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await conn.execute(
        `UPDATE oauth_auth_codes SET used = 1 WHERE code = ?`,
        [code],
      );

      await conn.commit();
      return row.colaborador_id;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─── Token generation ─────────────────────────────────────────────────────

  async generateToken(
    colab: ColaboradorInfo,
    grants: ToolGrant[],
  ): Promise<{
    jti: string;
    token: string;
    expiresAt: Date;
    expiresIn: number;
  }> {
    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL');
    const expiresIn = parseInt(this.config.get('JWT_EXPIRES_IN') ?? '3600', 10);
    const jti = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const token = await new SignJWT({
      email: colab.email,
      nome: colab.nome,
      // claim `scope`: concessões ferramenta:ESCOPO resolvidas via mcp_perfis_escopo
      // (ex.: "whoami:USO get_os:LEITURA"). Distinto do claim `profiles` (perfis crus).
      scope: grants.map((g) => `${g.ferramenta}:${g.escopo}`).join(' '),
      profiles: colab.profiles.join(' '),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'default' })
      .setJti(jti)
      .setSubject(String(colab.id))
      .setIssuer(publicUrl)
      .setAudience(publicUrl)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.keys.getPrivateKey());

    return { jti, token, expiresAt, expiresIn };
  }

  issueRefreshToken(): string {
    return randomBytes(40).toString('base64url');
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /**
   * `data.profiles` grava a coluna `oauth_tokens.scopes` — que armazena os
   * PERFIS crus (não os grants ferramenta:escopo do claim `scope` do JWT).
   * Isso preserva o fallback de identidade usado em `validateAndRotateRefreshToken`
   * e mantém o orçamento de VARCHAR(1024) da coluna.
   */
  async persistTokens(data: {
    colaboradorId: number;
    userSessionId: string;
    accessJti: string;
    refreshToken: string;
    profiles: string;
    expiresAt: Date;
    refreshExpiresAt: Date;
  }): Promise<void> {
    await this.pool.execute(
      `INSERT INTO oauth_tokens
         (colaborador_id, user_session_id, access_jti, refresh_token, scopes, expires_at, refresh_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.colaboradorId,
        data.userSessionId,
        data.accessJti,
        data.refreshToken,
        data.profiles,
        data.expiresAt,
        data.refreshExpiresAt,
      ],
    );
  }

  async logAccess(
    colaboradorId: number,
    userSessionId: string,
    ip: string | null,
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO oauth_access_log (colaborador_id, user_session_id, ip) VALUES (?, ?, ?)`,
      [colaboradorId, userSessionId, ip ?? null],
    );
  }

  // ─── Refresh token ────────────────────────────────────────────────────────

  async validateAndRotateRefreshToken(oldRefreshToken: string): Promise<{
    colaboradorId: number;
    userSessionId: string;
    profiles: string;
  }> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // SELECT ... FOR UPDATE trava a linha até o commit, evitando que dois
      // /oauth/refresh concorrentes com o mesmo refresh_token (retry do
      // cliente, reconexão duplicada) rotacionem o mesmo token duas vezes.
      const [rows] = await conn.execute<TokenRow[]>(
        `SELECT colaborador_id, user_session_id, scopes
           FROM oauth_tokens
          WHERE refresh_token = ?
            AND revoked = 0
            AND refresh_expires_at > NOW()
          LIMIT 1 FOR UPDATE`,
        [oldRefreshToken],
      );

      const row = rows[0];
      if (!row) {
        await conn.rollback();
        throw new HttpException(
          {
            error: 'invalid_grant',
            error_description: 'Refresh token inválido ou expirado',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await conn.execute(
        `UPDATE oauth_tokens SET revoked = 1 WHERE refresh_token = ?`,
        [oldRefreshToken],
      );

      await conn.commit();
      return {
        colaboradorId: row.colaborador_id,
        userSessionId: row.user_session_id,
        profiles: row.scopes,
      };
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─── Revogação (logout) ───────────────────────────────────────────────────

  /** Revoga a linha correspondente a um access_token (por jti), se existir. */
  async revokeByAccessJti(jti: string): Promise<boolean> {
    const [result]: any = await this.pool.execute(
      `UPDATE oauth_tokens SET revoked = 1 WHERE access_jti = ? AND revoked = 0`,
      [jti],
    );
    return result.affectedRows > 0;
  }

  /** Revoga a linha correspondente a um refresh_token, se existir. */
  async revokeByRefreshToken(refreshToken: string): Promise<boolean> {
    const [result]: any = await this.pool.execute(
      `UPDATE oauth_tokens SET revoked = 1 WHERE refresh_token = ? AND revoked = 0`,
      [refreshToken],
    );
    return result.affectedRows > 0;
  }
}
