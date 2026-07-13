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
import { decodeJwt } from 'jose';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { ColaboradorService } from '../colaborador/colaborador.service';
import { KeysService } from '../auth/keys.service';
import { ScopeService } from '../scope/scope.service';
import { SessionRegistryService } from '../mcp/session-registry.service';

@Controller()
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly colaborador: ColaboradorService,
    private readonly keys: KeysService,
    private readonly config: ConfigService,
    private readonly scopeService: ScopeService,
    private readonly sessionRegistry: SessionRegistryService,
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
   * Persistimos client_id + redirect_uris: /oauth/authorize passa a validar o
   * redirect_uri recebido contra esta lista (match exato), fechando o open
   * redirect que existia quando qualquer redirect_uri era aceito sem checagem.
   */
  @Post('oauth/register')
  async register(@Req() req: Request) {
    const body = req.body as Record<string, any>;
    const redirectUris: string[] = Array.isArray(body.redirect_uris)
      ? body.redirect_uris
      : [];

    if (!redirectUris.length) {
      throw new HttpException(
        { error: 'invalid_client_metadata', error_description: 'redirect_uris é obrigatório' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const clientId = await this.oauthService.registerClient(redirectUris);

    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
  }

  // ─── Passo 1: Claude inicia o fluxo ───────────────────────────────────────
  /**
   * Claude chama /oauth/authorize com client_id, redirect_uri, state e PKCE
   * (code_challenge/code_challenge_method=S256 — obrigatório, RFC 7636/OAuth 2.1
   * para clients públicos). Validamos redirect_uri contra o que foi registrado
   * em /oauth/register, guardamos o contexto e redirecionamos ao B2B.
   */
  @Get('oauth/authorize')
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') claudeRedirectUri: string,
    @Query('state') claudeState: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Res() res: Response,
  ) {
    if (!clientId || !claudeRedirectUri || !claudeState) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Missing required parameters: client_id, redirect_uri, state' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      throw new HttpException(
        {
          error: 'invalid_request',
          error_description: 'code_challenge (method S256) é obrigatório',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Lança 400 se client_id for desconhecido ou redirect_uri não bater
    // exatamente com algum registrado em /oauth/register.
    await this.oauthService.validateClientRedirectUri(clientId, claudeRedirectUri);

    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL');
    const b2bLoginUrl = this.config.getOrThrow<string>('B2B_LOGIN_URL');
    const callbackUri = `${publicUrl}/oauth/callback`;

    const ourState = this.oauthService.createPendingState({
      claudeRedirectUri,
      claudeState,
      clientId,
      codeChallenge,
      codeChallengeMethod,
    });

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
    const { claudeRedirectUri, claudeState, clientId, codeChallenge, codeChallengeMethod } =
      this.oauthService.consumePendingState(ourState);

    // 2. Verifica o code HMAC-SHA256 localmente (sem chamada ao B2B)
    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL');
    const callbackUri = `${publicUrl}/oauth/callback`;

    const colaboradorId = this.oauthService.verifyOAuthCode(
      b2bCode,
      callbackUri,
    );

    // 3. Gera nosso próprio auth code (single-use, 5 min), vinculado ao
    //    client_id/redirect_uri/code_challenge do /authorize original.
    const ourCode = await this.oauthService.generateAuthCode({
      colaboradorId,
      clientId,
      redirectUri: claudeRedirectUri,
      codeChallenge,
      codeChallengeMethod,
    });

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
    const { grant_type } = body;

    if (grant_type === 'refresh_token') {
      return this.handleRefreshGrant(body);
    }

    if (grant_type !== 'authorization_code') {
      throw new HttpException(
        { error: 'unsupported_grant_type' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const { code, client_id, redirect_uri, code_verifier } = body;

    if (!code || !client_id || !redirect_uri || !code_verifier) {
      throw new HttpException(
        {
          error: 'invalid_request',
          error_description: 'Missing code, client_id, redirect_uri or code_verifier',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Consome o auth code (valida PKCE + client_id/redirect_uri contra o /authorize original)
    const colaboradorId = await this.oauthService.consumeAuthCode(
      code,
      client_id,
      redirect_uri,
      code_verifier,
    );

    // 2. Busca scopes em grupopll_master.cadastro_colaborador
    let colab;
    try {
      colab = await this.colaborador.getColaboradorScopes(colaboradorId);
    } catch (err) {
      throw new HttpException(
        {
          error: 'invalid_grant',
          error_description: 'Colaborador não encontrado',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Resolve as concessões ferramenta:escopo dos perfis e emite JWT RS256
    //    (com claim scope) e refresh_token opaco
    const grants = await this.scopeService.resolveGrants(colab.profiles);
    const { jti, token: accessToken, expiresAt, expiresIn } =
      await this.oauthService.generateToken(colab, grants);

    const refreshToken = this.oauthService.issueRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const familyId = this.oauthService.issueFamilyId();

    // 4. Persiste tokens e registra o acesso
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      null;

    await Promise.all([
      this.oauthService.persistTokens({
        colaboradorId: colab.id,
        userSessionId: code,
        accessJti: jti,
        refreshToken,
        profiles: colab.profiles.join(' '),
        clientId: client_id,
        familyId,
        expiresAt,
        refreshExpiresAt,
      }),
      this.oauthService.logAccess(colab.id, code, ip),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  // ─── Passo 4 (eventual): Claude renova o access_token ─────────────────────
  /**
   * Troca refresh_token por novo access_token. Rotaciona o refresh_token (single-rotation).
   * Precisa ser tratado dentro de /oauth/token: é o único token_endpoint anunciado
   * no discovery, e por RFC 6749 §6 o client manda grant_type=refresh_token para lá,
   * não para uma rota separada.
   */
  private async handleRefreshGrant(body: Record<string, string>) {
    const { refresh_token } = body;

    if (!refresh_token) {
      throw new HttpException(
        {
          error: 'invalid_request',
          error_description: 'Missing refresh_token',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const {
      colaboradorId,
      userSessionId,
      profiles: storedProfiles,
      clientId,
      familyId,
    } = await this.oauthService.validateAndRotateRefreshToken(refresh_token);

    // Tenta buscar dados atualizados do banco; fallback para os perfis armazenados no token
    let colab = {
      id: colaboradorId,
      email: '',
      nome: '',
      profiles: storedProfiles.split(' ').filter(Boolean),
    };
    try {
      const fresh = await this.colaborador.getColaboradorScopes(colaboradorId);
      colab = fresh;
    } catch {
      // mantém os dados armazenados
    }

    const grants = await this.scopeService.resolveGrants(colab.profiles);
    const {
      jti,
      token: accessToken,
      expiresAt,
      expiresIn,
    } = await this.oauthService.generateToken(colab, grants);
    const newRefreshToken = this.oauthService.issueRefreshToken();
    const newRefreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.oauthService.persistTokens({
      colaboradorId: colab.id,
      userSessionId,
      accessJti: jti,
      refreshToken: newRefreshToken,
      profiles: colab.profiles.join(' '),
      clientId,
      familyId,
      expiresAt,
      refreshExpiresAt: newRefreshExpiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  // ─── Logout / revogação (RFC 7009) ────────────────────────────────────────
  /**
   * Revoga um access_token ou refresh_token. Marca `revoked = 1` em
   * oauth_tokens — a partir daí o JwtStrategy passa a rejeitar o access_token
   * (checagem por jti) e o /oauth/refresh deixa de aceitar o refresh_token.
   * Por spec (RFC 7009), sempre responde 200 mesmo se o token já não existir.
   */
  @Post('oauth/revoke')
  async revoke(@Req() req: Request) {
    const body = req.body as Record<string, string>;
    const { token, token_type_hint } = body;

    if (!token) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Missing token' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const tryRefreshFirst = token_type_hint === 'refresh_token';

    const attempts = tryRefreshFirst
      ? [
          () => this.oauthService.revokeByRefreshToken(token),
          () => this.revokeAccessTokenByJwt(token),
        ]
      : [
          () => this.revokeAccessTokenByJwt(token),
          () => this.oauthService.revokeByRefreshToken(token),
        ];

    for (const attempt of attempts) {
      if (await attempt()) break;
    }

    return {};
  }

  private async revokeAccessTokenByJwt(token: string): Promise<boolean> {
    try {
      const payload = decodeJwt(token);
      if (!payload.jti) return false;
      const revoked = await this.oauthService.revokeByAccessJti(payload.jti);
      // Derruba a sessão MCP já aberta com esse token — sem isso, revogar no
      // banco só bloquearia a *próxima* requisição, e a conexão em memória
      // continuaria servindo normalmente até o cliente fechar por conta própria.
      await this.sessionRegistry.closeSessionsForJti(payload.jti);
      return revoked;
    } catch {
      return false;
    }
  }
}
