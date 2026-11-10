# CLAUDE.md — miganado

## Principios de trabajo

- **Piensa antes de codear.** No asumas. No escondas la confusion. Si hay varias
  interpretaciones, pregunta antes de decidir en silencio. Nombra los tradeoffs.
- **Simplicidad primero.** El minimo codigo que resuelve el problema. Nada
  especulativo: sin abstracciones prematuras, sin features no pedidas, sin manejo
  de errores para casos que no pasan. El usuario trabaja desde el celular en el
  campo, a pleno sol — desconfia de formularios largos y flujos enredados.
- **Cambios quirurgicos.** Toca solo lo necesario y respeta el estilo existente.
  No "mejores" codigo no relacionado. Borra solo lo que TU cambio dejo obsoleto,
  no codigo muerto preexistente.
- **Criterio de exito verificable.** Convierte "que funcione" en un objetivo
  testeable. Cambios de UI: pruebalos en el navegador (golden path + bordes).
  Backend: valida con la migracion/endpoint real, no de palabra.

## Documentacion viva → actualiza el README al cambiar funcionalidad

Cuando agregues, cambies o quites una funcionalidad, actualiza la documentacion
**en el mismo cambio**, no despues:

- `README.md` describe el **presente**: lo que la app SI hace hoy (modelo de
  datos, tabla de endpoints, flujos, variables de entorno). Si tocas el esquema
  Prisma o agregas/quitas endpoints, refleja el modelo de datos y la tabla de
  endpoints del README.
- `docs/roadmap.md` describe el **futuro**: si la funcionalidad estaba en el
  roadmap, marcala/muevela; si surge una idea nueva que se aplaza, agregala.

Regla simple: si un cambio haria que el README mienta, el cambio no esta completo
hasta arreglar el README.

## Migraciones Prisma → NO reescribas la historia

Las migraciones de `backend/prisma/migrations/` son **append-only** una vez que
salieron de tu rama local. NO edites, renombres, ni borres una migracion que ya
esta en `main` o que pudo haber corrido en cualquier entorno (prod, staging,
dev compartido). Aunque cambie tu idea sobre el modelo, esa migracion ya forma
parte de la historia ejecutada en alguna DB — borrarla del repo crea drift
imposible de reconciliar automaticamente (Prisma marcara `_prisma_migrations`
filas huerfanas y las nuevas migraciones pueden chocar con objetos que ya
existen, e.g. `CREATE TYPE` sobre un enum ya creado → P3009).

Si necesitas cambiar el modelo:

- Crea una **nueva** migracion encima que lleve del estado anterior al nuevo
  (`ALTER`, backfill, `DROP`). Es codigo extra pero es la unica forma segura.
- Nunca consolides varias migraciones en una "limpia" reemplazando archivos.
- Si vas a tocar una migracion que aun NO se ha mergeado y nadie mas la corrio,
  confirma con el usuario que esta seguro de que ningun entorno la aplico.

Regla simple: si tu cambio implica borrar o reescribir un archivo bajo
`backend/prisma/migrations/`, **detente y confirma con el usuario** antes de
hacerlo. Casi siempre la respuesta correcta es agregar una migracion nueva.

## Opinion de negocio/dominio → usa el subagente `experto-cuidado-ganado`

Cuando el usuario haga cambios o agregue funcionalidades del dominio (lotes,
animales, potreros, fincas, pastoreo, sanidad, reproduccion, pesaje,
comercializacion/feria) y quiera validar si tiene sentido en el campo —o cuando
pida "una opinion", "que opinaria un ganadero", "valida esto", "tiene sentido para
el cliente"— invoca el subagente `experto-cuidado-ganado` via la tool Agent.

Es un stakeholder (un ganadero real de Cordoba) que opina desde el cuidado del
ganado y la rentabilidad: da veredicto, reparos del campo y prioridades. Es de
solo lectura: NO implementa codigo, solo aporta criterio. Definido en
`.claude/agents/experto-cuidado-ganado.md`. Conviene consultarlo ANTES de
implementar features de dominio o justo despues de diseñarlas.

## Problemas de produccion → usa el subagente `coolify-devops:coolify-admin`

Cuando el usuario reporte un problema en produccion (sitio caido, contenedor unhealthy,
deploy fallido, errores 5xx, certificados, DNS, falta de disco/RAM, logs del servidor,
etc.), invoca el subagente `coolify-devops:coolify-admin` via la tool Agent. Ese
subagente tiene SSH al servidor de Coolify (`root@104.131.41.153`) y puede inspeccionar
contenedores, logs, recursos y estado de la plataforma.

No intentes diagnosticar produccion solo con el codigo local — el estado real vive en
el servidor.
