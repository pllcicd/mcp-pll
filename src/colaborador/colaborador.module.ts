import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ColaboradorService } from './colaborador.service';

@Module({
  imports: [DatabaseModule],
  providers: [ColaboradorService],
  exports: [ColaboradorService],
})
export class ColaboradorModule {}
