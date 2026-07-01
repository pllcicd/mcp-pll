import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { AuthModule } from '../auth/auth.module';
import { ColaboradorModule } from '../colaborador/colaborador.module';
import { DatabaseModule } from '../database/database.module';
import { ScopeModule } from '../scope/scope.module';

@Module({
  imports: [AuthModule, ColaboradorModule, DatabaseModule, ScopeModule],
  controllers: [OAuthController],
  providers: [OAuthService],
})
export class OAuthModule {}
