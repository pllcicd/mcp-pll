import { Module } from '@nestjs/common';
import { B2BService } from './b2b.service';

@Module({
  providers: [B2BService],
  exports: [B2BService],
})
export class B2BModule {}
