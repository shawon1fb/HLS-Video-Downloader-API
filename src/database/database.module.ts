import { Global, Module } from '@nestjs/common';
import { createDatabaseConnection } from './connection';
import { DatabaseConfig } from '../config/database.config';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: (databaseConfig: DatabaseConfig) => {
        return createDatabaseConnection(databaseConfig);
      },
      inject: [DatabaseConfig],
    },
    DatabaseService,
  ],
  exports: ['DATABASE_CONNECTION', DatabaseService],
})
export class DatabaseModule {}
