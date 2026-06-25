import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PllApiModule } from '../pll-api/pll-api.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [DatabaseModule, PllApiModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
