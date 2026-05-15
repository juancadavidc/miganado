# miganado 🐂

App fullstack para registrar **entregas de ganado a feria comercial**: lotes, animales individuales, gastos extras y fotos.

Inspirada en la planilla **Centro Comercial Ganadero SAS** (Buenavista, Córdoba).

## Stack

- **Frontend:** Vite + React + TypeScript + React Router
- **Backend:** Express + TypeScript + Prisma + JWT + Multer
- **DB:** PostgreSQL (en docker-compose)

## Estructura

```
miganado/
├── docker-compose.yml      # Postgres 16
├── backend/                # API Express
│   ├── prisma/             # esquema y migraciones
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/         # auth, lotes, animales, gastos, fotos
│   │   ├── middleware/auth.ts
│   │   └── lib/            # prisma, env
│   └── uploads/            # fotos subidas (no commiteado)
└── frontend/               # SPA Vite + React
    └── src/
        ├── pages/          # Login, Registro, Dashboard, Lote
        ├── components/
        ├── auth/           # contexto auth
        ├── api/            # cliente fetch + manejo token
        └── lib/format.ts   # formato dinero/peso/fecha
```

## Setup local

### 1. Levantar PostgreSQL

```bash
docker compose up -d
```

Postgres queda en `localhost:5433` (puerto **5433** para no chocar con otras instancias locales).

### 2. Backend

```bash
cd backend
cp .env.example .env       # ajusta JWT_SECRET para producción
npm install
npx prisma migrate deploy  # aplica las migraciones existentes
npm run dev                # http://localhost:4000
```

Endpoints REST:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/health`        | health check |
| POST | `/api/auth/register` | registrar (documento, nombre, password) |
| POST | `/api/auth/login`    | login con documento |
| GET  | `/api/auth/me`       | usuario actual |
| GET  | `/api/lotes`         | listar mis lotes |
| GET  | `/api/lotes/:id`     | detalle de un lote |
| POST | `/api/lotes`         | crear lote |
| PUT  | `/api/lotes/:id`     | editar lote |
| DELETE | `/api/lotes/:id`   | eliminar lote |
| POST | `/api/animales`      | crear animal individual en un lote |
| PUT  | `/api/animales/:id`  | editar animal |
| DELETE | `/api/animales/:id`| eliminar animal |
| POST | `/api/gastos`        | crear gasto |
| DELETE | `/api/gastos/:id`  | eliminar gasto |
| POST | `/api/fotos`         | subir foto (form-data: `foto`, `loteId` o `animalId`) |
| DELETE | `/api/fotos/:id`   | eliminar foto |

Las fotos se sirven en `/uploads/<filename>`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

El dev server tiene proxy a `/api` y `/uploads` hacia `localhost:4000`.

### 4. Build de producción

```bash
cd frontend && npm run build   # dist/
cd backend && npm run build    # dist/
```

## Modelo de datos

- **User** — login con número de documento de identidad
- **Lote** — la unidad principal (una entrega a la feria): fecha, n° feria, sexo, cantidad, peso total/promedio, valor final ($/kg), valor total, deducción, referencia, valor a pagar, notas
- **Animal** — animales individuales dentro de un lote, con su propio peso/sexo/identificador
- **Gasto** — gastos extras asociados al lote (transporte, comisiones, etc.)
- **Foto** — fotos que pueden estar pegadas a un lote o a un animal individual

### Catálogo de sexos

| Código | Significado |
|--------|-------------|
| VP | Vaca parida (con cría) |
| HV | Hembra de vientre / novilla |
| HL | Hembra de levante / ternera |
| ML | Macho de levante / ternero |
| MC | Macho de ceba (machos más grandes) |
| TO | Toro |

Cuando el lote es **VP**, se registran `criasMacho` y `criasHembra` (cantidad por sexo de cría).
Cuando un animal individual es **VP**, puede registrar el sexo de su cría (M/H).

## Notas

- Las contraseñas se almacenan con `bcrypt`. El `JWT_SECRET` del `.env.example` es solo para dev — **cámbialo en producción**.
- Las fotos subidas se guardan en disco (`backend/uploads/`); no se commitea el contenido al repo.
- Tamaño máximo por foto: 10 MB.
