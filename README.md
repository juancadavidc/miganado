# miganado 🐂

App fullstack para gestionar **ceba de ganado**: el dueño compra ganado en feria,
lo pone al cuidado de un cuidador en una finca, y registra el lote (compra,
animales, gastos y fotos). Incluye mapa de potreros y captura de la **planilla de
feria** por foto (OCR con IA). Hoy el `Lote` representa la **compra** del ganado;
la vida en finca (pesajes/GMD) y la venta están en el roadmap.

Inspirada en la planilla **Centro Comercial Ganadero SAS** (Buenavista, Córdoba).

> ¿Hacia dónde va? Mira [`docs/roadmap.md`](docs/roadmap.md) para la priorización
> de las próximas funcionalidades (pesajes/GMD, rotación de potreros, venta en
> feria, utilidad real).

## Stack

- **Frontend:** Vite + React + TypeScript + React Router. **PWA** instalable
  (vite-plugin-pwa).
- **Backend:** Express + TypeScript + Prisma + JWT + Multer + Zod.
- **DB:** PostgreSQL 16 (en docker-compose).
- **Almacenamiento de fotos:** Cloudflare R2 (S3-compatible, AWS SDK).
- **IA:** Anthropic Claude (Vision) para extraer la tabla de la planilla de feria.

## Estructura

```
miganado/
├── docker-compose.yml      # Postgres 16
├── backend/                # API Express
│   ├── prisma/             # esquema y migraciones
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/         # auth, fincas, potreros, lotes, lotesImport,
│   │   │                   #   animales, gastos, fotos, anotaciones, traslados
│   │   ├── middleware/auth.ts
│   │   └── lib/            # prisma, env, r2 (Cloudflare), fincaAccess (permisos)
│   └── uploads/            # (legado; las fotos hoy van a R2)
└── frontend/               # SPA Vite + React (PWA)
    └── src/
        ├── pages/          # Login, Registro, Dashboard, Fincas, FincaDetalle,
        │                   #   LoteForm, LoteImport, LoteDetalle, Traslados
        ├── components/      # Navbar, PotreroMapa, Anotaciones, SexoBadge, ...
        ├── auth/           # contexto auth
        ├── api/            # cliente fetch + manejo token
        └── lib/format.ts   # formato dinero/peso/fecha
```

## Setup local

### 1. Levantar PostgreSQL

```bash
docker compose up -d
```

Postgres queda en `localhost:5433` (puerto **5433** para no chocar con otras
instancias locales).

### 2. Backend

```bash
cd backend
cp .env.example .env       # ajusta JWT_SECRET y, si usarás OCR/fotos, las claves de Anthropic y R2
npm install
npx prisma migrate deploy  # aplica las migraciones existentes
npm run dev                # http://localhost:4000
```

Variables de entorno (ver `backend/.env.example`):

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` | conexión a Postgres |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | firma/expiración del token |
| `CORS_ORIGIN` | origen permitido del frontend |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | OCR de planillas con Claude Vision |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | almacenamiento de fotos en Cloudflare R2 |

### Endpoints REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/health`        | health check |
| POST | `/api/auth/register` | registrar (documento, nombre, password) |
| POST | `/api/auth/login`    | login con documento |
| GET  | `/api/auth/me`       | usuario actual |
| GET  | `/api/fincas`        | listar fincas (propias y que cuido) |
| GET  | `/api/fincas/:id`    | detalle de finca + traslados pendientes |
| POST | `/api/fincas`        | crear finca |
| PUT  | `/api/fincas/:id`    | editar nombre/propiedades |
| DELETE | `/api/fincas/:id`  | eliminar finca (solo dueño) |
| POST | `/api/fincas/:id/cuidador` | asignar/cambiar cuidador |
| DELETE | `/api/fincas/:id/cuidador` | quitar cuidador |
| POST | `/api/fincas/:id/dueno` | transferir propiedad (requiere aceptación) |
| GET  | `/api/potreros?fincaId=` | listar potreros de una finca |
| POST | `/api/potreros`      | crear potrero |
| PUT  | `/api/potreros/:id`  | editar (nombre, notas, metadatos, ocupado, grid) |
| DELETE | `/api/potreros/:id`| eliminar potrero |
| GET  | `/api/lotes`         | listar mis lotes |
| GET  | `/api/lotes/:id`     | detalle de un lote (animales, gastos, fotos, anotaciones) |
| POST | `/api/lotes`         | crear lote |
| PUT  | `/api/lotes/:id`     | editar lote (campos según rol dueño/cuidador) |
| DELETE | `/api/lotes/:id`   | eliminar lote (solo dueño) |
| POST | `/api/lotes/extract` | OCR: extraer lotes de una foto de planilla (no guarda) |
| POST | `/api/lotes/bulk`    | guardar varios lotes de una vez |
| POST | `/api/animales`      | crear animal individual en un lote |
| PUT  | `/api/animales/:id`  | editar animal |
| DELETE | `/api/animales/:id`| eliminar animal |
| POST | `/api/gastos`        | crear gasto |
| DELETE | `/api/gastos/:id`  | eliminar gasto |
| POST | `/api/fotos`         | subir foto (form-data: `foto`, `loteId` o `animalId`) → R2 |
| DELETE | `/api/fotos/:id`   | eliminar foto |
| POST | `/api/anotaciones`   | crear anotación (en `loteId`, `animalId` o `gastoId`) |
| PUT  | `/api/anotaciones/:id` | editar anotación |
| DELETE | `/api/anotaciones/:id` | eliminar anotación |
| GET  | `/api/traslados`     | traslados recibidos y enviados |
| POST | `/api/traslados/:id/aceptar`  | aceptar traslado (destinatario) |
| POST | `/api/traslados/:id/rechazar` | rechazar traslado (destinatario) |
| POST | `/api/traslados/:id/cancelar` | cancelar traslado (quien lo creó) |

Las fotos se almacenan en Cloudflare R2 y se sirven mediante `R2_PUBLIC_URL`.

### 3. (Opcional) Cargar datos de prueba

```bash
cd backend
npm run seed
```

Crea (o resetea) un usuario demo y lotes de muestra basados en la planilla real.

- **Documento:** `1234`
- **Contraseña:** `miganado`

El script borra los datos previos del usuario demo antes de recrearlos, así que
se puede ejecutar tantas veces como quieras — los datos quedan en un estado
conocido.

> Para el entorno de la app desplegada/local hay además un usuario de prueba
> determinístico vía `scripts/seed-usuario-prueba.sh` (documento `1234`,
> contraseña `prueba1234`). Ver `CLAUDE.md`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

El dev server tiene proxy a `/api` hacia `localhost:4000`.

### 5. Build de producción

```bash
cd frontend && npm run build   # dist/ (genera además los assets PWA)
cd backend && npm run build    # dist/
```

## Modelo de datos

- **User** — login con número de documento de identidad. Puede ser dueño y/o
  cuidador de varias fincas.
- **Finca** — unidad de propiedad y pastoreo. Tiene un **dueño** y, opcional, un
  **cuidador**. Capacidad fija (ancho del mapa: 16/32/64 columnas) y
  `propiedades` libres (clave-valor: ubicación, municipio, vereda, etc.). Todo lo
  que vive en la finca (potreros y lotes) hereda quién la posee y la cuida.
- **Potrero** — zona de pastoreo dentro de una finca. Estado *Ocupado* / *En
  descanso* (manual) con fecha, `metadatos` libres (área, tipo de pasto, aforo,
  agua…) y posición/tamaño en el mapa visual (`gridX/Y/W/H`).
- **Lote** — **compra** de un lote de ganado en feria/subasta (la unidad principal
  hoy; nace al comprar, antes de cebarlo): fecha, n° feria, n° lote, sexo,
  cantidad, peso total/promedio, valor final ($/kg), valor total, deducción,
  referencia, valor a pagar (lo que se paga al comprar), notas. La vida en finca
  (pesajes/GMD) y la venta aún no se registran — ver `docs/roadmap.md`.
- **Animal** — animales individuales dentro de un lote, con su propio peso / sexo
  / identificador.
- **Gasto** — gastos asociados al lote (transporte, comisiones, etc.).
- **Foto** — fotos pegadas a un lote o a un animal (almacenadas en R2).
- **Anotacion** — comentario de texto libre pegado a un lote, un animal o un
  gasto.
- **Traslado** — solicitud de transferir el **rol** de una finca (DUENO o
  CUIDADOR) a otro usuario; queda PENDIENTE hasta que el destinatario la
  acepte/rechace (o el creador la cancele).

### Roles por finca (dueño vs cuidador)

- **Dueño:** crea/edita/elimina la finca, transfiere propiedad/cuidado, y edita
  los **valores comerciales de la compra** del lote (n° feria, n° lote, valor
  final/total, deducción, referencia, valor a pagar). Solo el dueño puede eliminar
  lotes.
- **Cuidador:** hace el trabajo del día — potreros, animales, gastos, fotos,
  anotaciones — y edita los **datos operativos** del lote (fecha, sexo, cantidad,
  peso, notas, crías).

### Catálogo de sexos

| Código | Significado |
|--------|-------------|
| VP | Vaca parida (con cría) |
| HV | Hembra de vientre / novilla |
| HL | Hembra de levante / ternera |
| ML | Macho de levante / ternero |
| MC | Macho de ceba (machos más grandes) |
| TO | Toro |

Cuando el lote es **VP**, se registran `criasMacho` y `criasHembra` (cantidad por
sexo de cría). Cuando un animal individual es **VP**, puede registrar el sexo de
su cría (M/H).

> Nota de alcance: el negocio actual es **ceba pura** (ver `docs/roadmap.md`). En
> la compra de engorde solo entran `ML` y `MC`; los códigos `VP`/`HV`/`TO` y la
> lógica de crías existen en el esquema pero no aplican a ceba.

## Importar planilla de feria por foto (OCR)

`POST /api/lotes/extract` recibe la **foto de la planilla CXC de la compra**
("Relación de Cuentas por Cobrar / ENTREGAS - CXC" del centro ganadero) y usa
Claude Vision para extraer la tabla de lotes (fecha, n° feria, n° lote, sexo,
cantidad, peso, valores…). El frontend (`/lotes/importar`) muestra el resultado en
una tabla editable, recalcula peso promedio / valor total / valor a pagar, y
guarda todo en una finca con `POST /api/lotes/bulk`.

## Notas

- Las contraseñas se almacenan con `bcrypt`. El `JWT_SECRET` del `.env.example`
  es solo para dev — **cámbialo en producción**.
- Las fotos subidas se guardan en Cloudflare R2; tamaño máximo por foto: 10 MB.
- La app es una **PWA instalable**. Las notificaciones (planeadas) serán **push
  en la PWA** y, por cliente, vía **Telegram** — ver `docs/roadmap.md`.
```
