import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';

export const DB_POOL = Symbol('DB_POOL');

@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool =>
        createPool({
          host:               config.getOrThrow('DB_HOST'),
          port:               parseInt(config.get('DB_PORT') ?? '3306', 10),
          user:               config.getOrThrow('DB_USER'),
          password:           config.getOrThrow('DB_PASSWORD'),
          database:           config.getOrThrow('DB_NAME'),
          charset:            'utf8mb4',
          timezone:           'Z',
          waitForConnections: true,
          connectionLimit:    10,
        }),
    },
  ],
  exports: [DB_POOL],
})
export class DatabaseModule {}
