import 'dotenv/config';

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Falta variable de entorno ${key}`);
  return v;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
};
