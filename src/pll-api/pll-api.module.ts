import { Module } from '@nestjs/common';
import { PllApiAuthService } from './pll-api-auth.service';

@Module({
  providers: [PllApiAuthService],
  exports: [PllApiAuthService],
})
export class PllApiModule {}
