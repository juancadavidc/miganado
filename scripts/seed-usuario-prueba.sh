#!/usr/bin/env bash
# seed-usuario-prueba.sh — crea (idempotente) un usuario de prueba determinístico
# en la BD LOCAL de desarrollo.
#
#   documento:   1234
#   contraseña:  prueba1234
#
# Apunta al postgres local de docker-compose.yml (puerto host 5433), NUNCA a
# producción. Útil para entrar a la app cuando se levanta en local sin tener que
# recordar credenciales. Correrlo varias veces es seguro: hace UPSERT, así que
# siempre deja el mismo usuario con la misma contraseña.
#
# Uso:
#   ./scripts/seed-usuario-prueba.sh
#
# Requisitos: el postgres local debe estar arriba (docker compose up -d) y psql en PATH.
#
# El passwordHash es un bcrypt (cost 10) de "prueba1234". La contraseña es de
# prueba, no es secreto. Para regenerarlo (p. ej. si cambias la contraseña):
#   cd backend && node -e "console.log(require('bcryptjs').hashSync('prueba1234',10))"
set -euo pipefail

# Conexión fija al postgres LOCAL (valores de docker-compose.yml). No usamos el
# DATABASE_URL de backend/.env a propósito: ese puede apuntar a producción.
PGHOST=localhost
PGPORT=5433
PGUSER=miganado
PGDATABASE=miganado
export PGPASSWORD=miganado_dev_password

DOCUMENTO='1234'
NOMBRE='Usuario Prueba'
PASSWORD_HASH='$2a$10$hFoZn3mMUbdCl3hN7LsRbuw7ycu9L2tEjF59tg80lJmCc2A8C2hiu'

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO "User" (id, documento, nombre, "passwordHash", "createdAt", "updatedAt")
VALUES ('usr_prueba_local', '${DOCUMENTO}', '${NOMBRE}', '${PASSWORD_HASH}', now(), now())
ON CONFLICT (documento) DO UPDATE
  SET "passwordHash" = EXCLUDED."passwordHash",
      nombre         = EXCLUDED.nombre,
      "updatedAt"    = now();
SQL

echo "Usuario de prueba listo en la BD local → documento: ${DOCUMENTO}  contraseña: prueba1234"
