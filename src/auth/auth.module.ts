import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeysService } from './keys.service';
import { JwtStrategy } from './jwt.strategy';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [PassportModule, DatabaseModule],
  providers: [KeysService, JwtStrategy],
  exports: [KeysService],
})
export class AuthModule {}
