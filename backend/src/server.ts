import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';
import authRouter from './routes/auth.js';
import lotesRouter from './routes/lotes.js';
import lotesImportRouter from './routes/lotesImport.js';
import trasladosRouter from './routes/traslados.js';
import animalesRouter from './routes/animales.js';
import prenezRouter from './routes/prenez.js';
import gastosRouter from './routes/gastos.js';
import pesajesRouter from './routes/pesajes.js';
import ventasRouter from './routes/ventas.js';
import fotosRouter from './routes/fotos.js';
import anotacionesRouter from './routes/anotaciones.js';
import potrerosRouter from './routes/potreros.js';
import fincasRouter from './routes/fincas.js';
import bulkRouter from './routes/bulk.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/lotes', lotesImportRouter);
app.use('/api/lotes', lotesRouter);
app.use('/api/traslados', trasladosRouter);
app.use('/api/animales', animalesRouter);
app.use('/api/prenez', prenezRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/pesajes', pesajesRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/fotos', fotosRouter);
app.use('/api/anotaciones', anotacionesRouter);
app.use('/api/potreros', potrerosRouter);
app.use('/api/fincas', fincasRouter);
app.use('/api/bulk', bulkRouter);

// Manejo genérico de errores
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

app.listen(env.PORT, () => {
  console.log(`miganado api → http://localhost:${env.PORT}`);
});
