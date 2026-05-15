import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { env } from './lib/env.js';
import authRouter from './routes/auth.js';
import lotesRouter from './routes/lotes.js';
import animalesRouter from './routes/animales.js';
import gastosRouter from './routes/gastos.js';
import fotosRouter from './routes/fotos.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/lotes', lotesRouter);
app.use('/api/animales', animalesRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/fotos', fotosRouter);

// Servir las fotos subidas
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// Manejo genérico de errores
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

app.listen(env.PORT, () => {
  console.log(`miganado api → http://localhost:${env.PORT}`);
});
