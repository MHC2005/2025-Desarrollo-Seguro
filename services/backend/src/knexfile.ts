// knexfile.ts
import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const getRequiredEnvVar = (varName: string, defaultValue?: string): string => {
  const value = process.env[varName] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${varName} is required but not set`);
  }
  return value;
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: getRequiredEnvVar('DB_HOST'),
      user: getRequiredEnvVar('DB_USER'),
      password: getRequiredEnvVar('DB_PASS'),
      database: getRequiredEnvVar('DB_NAME'),
      port: parseInt(getRequiredEnvVar('DB_PORT', '5432')),
    },
    migrations: {
      directory: '../migrations',
    },
    seeds: {
      directory: '../seeds',
    },
  },
};

export default config;
