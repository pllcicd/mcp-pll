import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScopeService } from './scope.service';

@Module({
  imports: [DatabaseModule],
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
