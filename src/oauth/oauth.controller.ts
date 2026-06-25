import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { ColaboradorService } from '../colaborador/colaborador.service';
import { KeysService } from '../auth/keys.service';

@Controller()
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly colaborador: ColaboradorService,
    private readonly keys: KeysService,
    private readonly config: ConfigService,
  ) {}

  // ─── Discovery / JWKS ─────────────────────────────────────────────────────

  @Get('.well-known/oauth-authorization-server')
  discovery() {
    return this.oauthService.getDiscoveryMetadata();
  }

  @Get('.well-known/jwks.json')
  jwks() {
    return this.keys.getJwks();
  }

  // ─── Dynamic Client Registration (RFC 7591) ───────────────────────────────
  /**
   * O mcp-remote (e outros clientes OAuth) registram-se aqui antes de iniciar o fluxo.
   * Geramos um client_id aleatório e devolvemos — não precisamos armazenar porque
   * não validamos client_id no /authorize (a segurança vem do HMAC do B2B).
   */
  @Post('oauth/register')
  register(@Req() req: Request) {
    const body = req.body as Record<string, any>;
    return {
      client_id:                randomBytes(16).toString('hex'),
      client_id_issued_at:      Math.floor(Date.now() / 1000),
      redirect_uris:            body.redirect_uris ?? [],
      token_endpoint_auth_method: 'none',
      grant_types:              ['authorization_code'],
      response_types:           ['code'],
    };
  }

  // ─── Passo 1: Claude inicia o fluxo ───────────────────────────────────────
  /**
   * Claude chama /oauth/authorize com seu redirect_uri e state.
   * Geramos nosso próprio state, salvamos o contexto do Claude e redirecionamos ao B2B.
   */
  @Get('oauth/authorize')
  authorize(
    @Query('redirect_uri') claudeRedirectUri: string,
    @Query('state') claudeState: string,
    @Res() res: Response,
  ) {
    if (!claudeRedirectUri || !claudeState) {
      throw new HttpException(
        'Missing required parameters: redirect_uri, state',
        HttpStatus.BAD_REQUEST,
      );
    }

    const publicUrl    = this.config.getOrThrow<string>('PUBLIC_URL');
    const b2bLoginUrl  = this.config.getOrThrow<string>('B2B_LOGIN_URL');
    const callbackUri  = `${publicUrl}/oauth/callback`;

    const ourState = this.oauthService.createPendingState(claudeRedirectUri, claudeState);

    const target = new URL(b2bLoginUrl);
    target.searchParams.set('redirect_uri', callbackUri);
    target.searchParams.set('state', ourState);

    res.redirect(302, target.toString());
  }

  // ─── Passo 2: B2B redireciona de volta ao nosso servidor ─────────────────
  /**
   * Recebe o code HMAC e state do B2B, verifica localmente e redireciona ao Claude
   * com nosso próprio auth code (que o Claude trocará em /oauth/token).
   */
  @Get('oauth/callback')
  async callback(
    @Query('code') b2bCode: string,
    @Query('state') ourState: string,
    @Res() res: Response,
  ) {
    if (!b2bCode || !ourState) {
      throw new HttpException(
        'Missing required parameters: code, state',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Recupera contexto do Claude e valida o state (previne CSRF)
    const { claudeRedirectUri, claudeState } =
      this.oauthService.consumePendingState(ourState);

    // 2. Verifica o code HMAC-SHA256 localmente (sem chamada ao B2B)
    const publicUrl   = this.config.getOrThrow<string>('PUBLIC_URL');
    const callbackUri = `${publicUrl}/oauth/callback`;

    const colaboradorId = this.oauthService.verifyOAuthCode(b2bCode, callbackUri);

    // 3. Gera nosso próprio auth code (single-use, 5 min)
    const ourCode = await this.oauthService.generateAuthCode(colaboradorId);

    // 4. Redireciona ao Claude com nosso code e o state original
    const target = new URL(claudeRedirectUri);
    target.searchParams.set('code', ourCode);
    target.searchParams.set('state', claudeState);

    res.redirect(302, target.toString());
  }

  // ─── Passo 3: Claude troca nosso code por tokens ──────────────────────────
  /**
   * Claude envia nosso auth code (recebido no callback).
   * Verificamos, buscamos os scopes do colaborador e emitimos JWT + refresh_token.
   */
  @Post('oauth/token')
  async token(@Req() req: Request) {
    const body = req.body as Record<string, string>;
    console.log('[TOKEN] body recebido:', JSON.stringify(body));
    console.log('[TOKEN] content-type:', req.headers['content-type']);

    const { grant_type, code } = body;
    console.log('[TOKEN] grant_type:', grant_type, '| code:', code);

    if (grant_type !== 'authorization_code') {
      console.log('[TOKEN] ERRO: grant_type inválido:', grant_type);
      throw new HttpException({ error: 'unsupported_grant_type' }, HttpStatus.BAD_REQUEST);
    }

    if (!code) {
      console.log('[TOKEN] ERRO: code ausente no body');
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Missing code' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Consome o auth code e obtém o colaboradorId
    console.log('[TOKEN] consumindo auth code:', code);
    let colaboradorId: number;
    try {
      colaboradorId = await this.oauthService.consumeAuthCode(code);
      console.log('[TOKEN] auth code consumido, colaboradorId:', colaboradorId);
    } catch (err) {
      console.log('[TOKEN] ERRO ao consumir auth code:', err);
      throw err;
    }

    // 2. Busca scopes em grupopll_master.cadastro_colaborador
    let colab;
    try {
      colab = await this.colaborador.getColaboradorScopes(colaboradorId);
      console.log('[TOKEN] colaborador encontrado:', colab.email, '| profiles:', colab.profiles);
    } catch (err) {
      console.log('[TOKEN] ERRO ao buscar colaborador:', err);
      throw new HttpException(
        { error: 'invalid_grant', error_description: 'Colaborador não encontrado' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Emite JWT RS256 (com claim scope) e refresh_token opaco
    console.log('[TOKEN] gerando JWT...');
    let jti: string, accessToken: string, expiresAt: Date, expiresIn: number;
    try {
      ({ jti, token: accessToken, expiresAt, expiresIn } =
        await this.oauthService.generateToken(colab));
      console.log('[TOKEN] JWT gerado, jti:', jti, '| expiresIn:', expiresIn);
    } catch (err) {
      console.log('[TOKEN] ERRO ao gerar JWT:', err);
      throw err;
    }

    const refreshToken      = this.oauthService.issueRefreshToken();
    const refreshExpiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 4. Persiste tokens e registra o acesso
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ??
      null;

    console.log('[TOKEN] persistindo tokens...');
    try {
      await Promise.all([
        this.oauthService.persistTokens({
          colaboradorId: colab.id,
          userSessionId: code,
          accessJti: jti,
          refreshToken,
          profiles: colab.profiles.join(' '),
          expiresAt,
          refreshExpiresAt,
        }),
        this.oauthService.logAccess(colab.id, code, ip),
      ]);
      console.log('[TOKEN] tokens persistidos com sucesso');
    } catch (err) {
      console.log('[TOKEN] ERRO ao persistir tokens:', err);
      throw err;
    }

    const response = {
      access_token:  accessToken,
      refresh_token: refreshToken,
      token_type:    'Bearer',
      expires_in:    expiresIn,
    };
    console.log('[TOKEN] resposta final:', JSON.stringify({ ...response, access_token: '[JWT]', refresh_token: '[OPAQUE]' }));
    return response;
  }

  // ─── Passo 4 (eventual): Claude renova o access_token ─────────────────────
  /**
   * Troca refresh_token por novo access_token. Rotaciona o refresh_token (single-rotation).
   */
  @Post('oauth/refresh')
  async refresh(@Req() req: Request) {
    const body = req.body as Record<string, string>;
    const { grant_type, refresh_token } = body;

    if (grant_type !== 'refresh_token') {
      throw new HttpException({ error: 'unsupported_grant_type' }, HttpStatus.BAD_REQUEST);
    }

    if (!refresh_token) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Missing refresh_token' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const { colaboradorId, userSessionId, profiles: storedProfiles } =
      await this.oauthService.validateAndRotateRefreshToken(refresh_token);

    // Tenta buscar dados atualizados do banco; fallback para os perfis armazenados no token
    let colab = {
      id:       colaboradorId,
      email:    '',
      nome:     '',
      profiles: storedProfiles.split(' ').filter(Boolean),
    };
    try {
      const fresh = await this.colaborador.getColaboradorScopes(colaboradorId);
      colab = fresh;
    } catch {
      // mantém os dados armazenados
    }

    const { jti, token: accessToken, expiresAt, expiresIn } =
      await this.oauthService.generateToken(colab);
    const newRefreshToken     = this.oauthService.issueRefreshToken();
    const newRefreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.oauthService.persistTokens({
      colaboradorId: colab.id,
      userSessionId,
      accessJti:        jti,
      refreshToken:     newRefreshToken,
      profiles:         colab.profiles.join(' '),
      expiresAt,
      refreshExpiresAt: newRefreshExpiresAt,
    });

    return {
      access_token:  accessToken,
      refresh_token: newRefreshToken,
      token_type:    'Bearer',
      expires_in:    expiresIn,
    };
  }
}
