# CLAUDE.md — miganado

## Problemas de produccion → usa el subagente `coolify-devops:coolify-admin`

Cuando el usuario reporte un problema en produccion (sitio caido, contenedor unhealthy,
deploy fallido, errores 5xx, certificados, DNS, falta de disco/RAM, logs del servidor,
etc.), invoca el subagente `coolify-devops:coolify-admin` via la tool Agent. Ese
subagente tiene SSH al servidor de Coolify (`root@104.131.41.153`) y puede inspeccionar
contenedores, logs, recursos y estado de la plataforma.

No intentes diagnosticar produccion solo con el codigo local — el estado real vive en
el servidor.

## Forzar redeploy en Coolify → `scripts/coolify-redeploy.sh`

Cuando se necesite re-pullear `:latest` de GHCR y recrear el contenedor (race con la
publicacion de la imagen, Cloudflare cache stale por 404 previo, cambio en env vars,
etc.) usa el script:

```bash
./scripts/coolify-redeploy.sh frontend          # redeploy normal
./scripts/coolify-redeploy.sh backend --force   # force rebuild
```

- Servicios validos: `frontend`, `backend`. Comparten el mismo UUID porque Coolify
  los maneja como un unico docker-compose stack — disparar uno redespliega el stack
  completo.
- Para agregar un nuevo servicio: una linea en el array `UUIDS` del script.
- El token de la API de Coolify NO esta en el repo; vive en el servidor en
  `/root/.coolify-token` (chmod 600). El header del script documenta como
  regenerarlo si se pierde.

El script ssh-ea al servidor, dispara `POST /api/v1/deploy?uuid=...` contra el
Coolify local y polea el estado hasta `finished`/`failed` (timeout 5 min).

Si despues del redeploy los assets nuevos siguen sirviendose stale desde el dominio
publico, casi seguro es Cloudflare cacheando una respuesta vieja — el origen ya esta
bien. Purga manual en CF dashboard o esperar ~4h al TTL.
