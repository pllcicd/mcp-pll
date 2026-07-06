import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  userId: string;
  jti?: string;
  lastActivity: number;
}

const IDLE_TTL_MS = 30 * 60 * 1000; // 30 min sem atividade — sessão é considerada abandonada
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Registro central das sessões MCP em memória. Existe para resolver dois
 * problemas que o `Map` local do controller antigo não resolvia:
 *  1. Vazamento de memória — clientes que somem sem chamar DELETE nunca
 *     tinham sua sessão removida.
 *  2. Logout que não derruba conexão ativa — revogar o token no banco só
 *     bloqueava a *próxima* requisição; a sessão MCP já aberta continuava
 *     servindo até o cliente encerrar por conta própria.
 */
@Injectable()
export class SessionRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionRegistryService.name);
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor() {
    this.sweepTimer = setInterval(() => this.sweepIdle(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.sweepTimer);
  }

  register(
    sessionId: string,
    transport: StreamableHTTPServerTransport,
    userId: string,
    jti: string | undefined,
  ): void {
    this.sessions.set(sessionId, {
      transport,
      userId,
      jti,
      lastActivity: Date.now(),
    });

    // Cobre o caso do cliente cair sem mandar DELETE (rede, crash, etc).
    transport.onclose = () => {
      this.sessions.delete(sessionId);
    };
  }

  get(sessionId: string): StreamableHTTPServerTransport | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;
    entry.lastActivity = Date.now();
    return entry.transport;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  async remove(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    this.sessions.delete(sessionId);
    await entry.transport.close().catch(() => {});
  }

  /** Chamado pelo /oauth/revoke — mata na hora qualquer sessão MCP aberta com o token revogado. */
  async closeSessionsForJti(jti: string): Promise<number> {
    const toClose = [...this.sessions.entries()].filter(
      ([, entry]) => entry.jti === jti,
    );
    for (const [sessionId] of toClose) {
      await this.remove(sessionId);
    }
    if (toClose.length) {
      this.logger.log(
        `Revogação encerrou ${toClose.length} sessão(ões) MCP ativa(s) para jti=${jti}`,
      );
    }
    return toClose.length;
  }

  private async sweepIdle(): Promise<void> {
    const now = Date.now();
    const stale = [...this.sessions.entries()].filter(
      ([, entry]) => now - entry.lastActivity > IDLE_TTL_MS,
    );
    for (const [sessionId] of stale) {
      await this.remove(sessionId);
    }
    if (stale.length) {
      this.logger.log(`Sweep removeu ${stale.length} sessão(ões) MCP ociosa(s)`);
    }
  }
}
