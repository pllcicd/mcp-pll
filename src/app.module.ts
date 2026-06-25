import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { McpModule } from './mcp/mcp.module';
import { PllApiModule } from './pll-api/pll-api.module';
import { OAuthModule } from './oauth/oauth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UserModule,
    AuthModule,
    OAuthModule,
    McpModule,
    PllApiModule,
  ],
})
export class AppModule {}
