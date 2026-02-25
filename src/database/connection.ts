import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DatabaseConfig } from '../config/database.config';

let dbConnection: ReturnType<typeof drizzle> | null = null;
let pool: Pool | null = null;

export const createDatabaseConnection = (config: DatabaseConfig) => {
  if (dbConnection) {
    return dbConnection;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  dbConnection = drizzle(pool, { schema });
  return dbConnection;
};

export const getDatabaseConnection = () => {
  if (!dbConnection) {
    throw new Error('Database connection not initialized');
  }
  return dbConnection;
};

export const closeDatabaseConnection = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    dbConnection = null;
  }
};
