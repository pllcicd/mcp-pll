import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { McpService } from './mcp.service';
import { SessionRegistryService } from './session-registry.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly sessionRegistry: SessionRegistryService,
  ) {}

  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && this.sessionRegistry.has(sessionId)) {
      const transport = this.sessionRegistry.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const user = (req as any).user;
    const server = this.mcpService.createServer(user);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.sessionRegistry.register(id, transport, user.userId, user.jti);
      },
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  @Get()
  async handleGet(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.sessionRegistry.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }

    const transport = this.sessionRegistry.get(sessionId)!;
    await transport.handleRequest(req, res);
  }

  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.sessionRegistry.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }

    const transport = this.sessionRegistry.get(sessionId)!;
    await transport.handleRequest(req, res);
    await this.sessionRegistry.remove(sessionId);
  }
}
