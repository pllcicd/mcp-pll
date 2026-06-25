import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeysService } from './keys.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule],
  providers: [KeysService, JwtStrategy],
  exports: [KeysService],
})
export class AuthModule {}
