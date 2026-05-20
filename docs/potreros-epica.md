# Épica — Potreros

Mapa visual de los potreros del rancho: el dueño dibuja su zona de pastoreo,
ve qué potrero está ocupado o en descanso, y rota el ganado entre potreros para
que el pasto se recupere.

> Estado: **Fase 1 entregada**. Las fases 2–4 son la visión completa que da
> contexto a las decisiones de la Fase 1; aún no están implementadas.

---

## Visión

Hoy la app gira alrededor del **Lote** (entrega a la feria). Los potreros agregan
la dimensión **espacial y temporal** del rancho:

- **Espacial**: dónde está cada potrero y cómo se conectan (mapa).
- **Temporal**: cuánto lleva ocupado o en descanso cada potrero, para manejar la
  rotación y la recuperación del pasto.

El objetivo final es que el ganadero **rote lotes (o grupos de lotes) entre
potreros** y la app le diga cuándo un potrero ya descansó lo suficiente o cuándo
uno ocupado se está quedando sin comida.

---

## Fase 1 — Base (ENTREGADA)

Lo que ya quedó funcionando en este PR:

- **Navbar lateral en mobile**: hamburguesa → drawer izquierdo con las secciones
  (Lotes, Potreros) + datos del usuario y salir. En escritorio los links van
  inline en la barra superior.
- **Sección Potreros** (`/potreros`): CRUD completo de potreros por usuario.
- **Estado de ocupación manual**: cada potrero es *Ocupado* o *En descanso*. Se
  cambia con un botón (Marcar ocupado / Liberar).
- **Tiempo sin ganado (descanso)**: al liberar un potrero se guarda la fecha; la
  UI muestra "Sin ganado hace N días" para saber cuánto lleva recuperándose. Al
  ocuparlo muestra "Con ganado hace N días".
- **KPIs**: total de potreros, ocupados y en descanso.

### Modelo de datos (actual)

```prisma
model Potrero {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  nombre       String
  ocupado      Boolean   @default(false)
  ocupadoDesde DateTime?   // se setea al marcar ocupado
  vacioDesde   DateTime?   // se setea al liberar (y al crear) → base del timer de descanso
  notas        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@index([userId])
}
```

### API (actual)

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/potreros` | Lista los potreros del usuario |
| POST | `/api/potreros` | Crea un potrero (nace *en descanso*, `vacioDesde = now`) |
| PUT | `/api/potreros/:id` | Edita nombre/notas y/o cambia `ocupado` (setea timestamps) |
| DELETE | `/api/potreros/:id` | Elimina el potrero |

---

## Fase 2 — Editor visual de cuadrícula

El corazón de la idea original: el dueño **dibuja** su rancho.

- El lienzo es una **cuadrícula de celdas**. Cada potrero ocupa una o varias
  celdas contiguas (un rectángulo).
- En **modo edición**, cada potrero muestra un **`+` en cada lado**. Al tocarlo,
  el potrero **se agranda una celda** hacia ese lado (las celdas se "unen" para
  formar un potrero más grande). Un `−` permite encogerlo.
- Se pueden crear **más potreros** en celdas libres y así el dueño va armando su
  zona. Los potreros **no se solapan**.
- El estado (ocupado / en descanso + días) se pinta sobre cada potrero en el mapa
  (semáforo de color: ocupado vs. descansando).

### Cambios de datos previstos

Agregar coordenadas de grilla al modelo (todas nullable hasta migrar los
existentes):

```prisma
gridX  Int?   // columna de la esquina superior izquierda
gridY  Int?   // fila
gridW  Int?   // ancho en celdas
gridH  Int?   // alto en celdas
```

Validación en backend: rectángulos sin solapamiento dentro del rancho del usuario.

---

## Fase 3 — Información y recuperación del pasto

"Que el potrero recolecte información" → enriquecer cada potrero:

- **Área** (hectáreas) y **tipo de pasto**.
- **Aforo / capacidad** (cuántas cabezas aguanta) → alerta de sobrepastoreo.
- **Días de descanso recomendados** por tipo de pasto → semáforo:
  - 🟡 descansando (no llegó al mínimo)
  - 🟢 listo para volver a ocupar
- **Historial de ocupación**: registro de cada periodo ocupado/libre para ver
  patrones de rotación (tabla `PotreroEvento` o similar).

---

## Fase 4 — Grupos de lotes y transferencias

El "más adelante" que mencionó el usuario:

- **Grupos de lotes**: agrupar varios `Lote` en un **Grupo** (la unidad que se
  mueve por el rancho).
- **Asignar grupo a potrero**: la ocupación deja de ser solo manual; un potrero
  está ocupado porque tiene un grupo dentro. El timer de descanso arranca solo
  cuando el grupo sale.
- **Transferencias**: mover un grupo de un potrero a otro "cuando se acaba la
  comida". Cada transferencia:
  - libera el potrero origen (arranca su descanso),
  - ocupa el potrero destino,
  - queda registrada en el historial (de dónde, a dónde, cuándo).
- **Sugerencias**: la app propone a qué potrero (en verde / ya descansado) mover
  un grupo cuyo potrero actual se está quedando sin pasto.

### Decisión de diseño relevante

En Fase 1 la ocupación es **manual** a propósito: los grupos todavía no existen.
Cuando llegue la Fase 4, la ocupación manual se reemplaza/complementa con la
ocupación derivada de "tiene un grupo asignado", reutilizando los mismos campos
`ocupado` / `ocupadoDesde` / `vacioDesde`.

---

## Decisiones tomadas (Q&A inicial)

- **Editor**: cuadrícula de celdas; el `+` une celdas para agrandar el potrero
  (no lienzo libre estilo Figma). → Fase 2.
- **Ocupación (v1)**: marca **manual** ocupado/libre con fecha. El vínculo con
  lotes/grupos viene después. → Fase 4.
- **Alcance del primer PR**: base primero (navbar + CRUD + ocupación/descanso),
  editor visual después. Esta épica documenta el resto.
