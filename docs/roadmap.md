# Roadmap — miganado

> Última actualización: **2026-09-20**.
> Este documento recoge la revisión de producto y la priorización de las
> próximas funcionalidades, validada con el stakeholder ganadero (Don Aníbal,
> ceba en Córdoba) a través del subagente `experto-cuidado-ganado`.

## El negocio (alcance definido)

miganado es para **ceba pura**. El ciclo del cliente es:

1. **Compra** ganado en subasta (el dueño pone la plata).
2. **Entrega al cuidador**, que lo administra en la finca (potreros, pasto,
   sanidad, día a día).
3. **Pesa el ganado periódicamente.**
4. **Vende en la feria** cuando el dueño, mirando los pesajes, decide que ya
   está para vender.

No hay cría: ni vacas de vientre, ni partos, ni levante propio. Entra un lote
comprado, se engorda, se vende.

## Diagnóstico

Hoy la app captura el paso 1 (la compra en feria/subasta), del paso 3 los
**pesajes en el tiempo → GMD**, y el paso 4 (las **ventas**, totales o parciales).
El `Lote` nace en la compra: la planilla
"Relación de Cuentas por Cobrar / ENTREGAS - CXC" del centro ganadero registra lo
que el ganadero **paga** al comprar (el "valor a pagar" sale de su bolsillo). De
la vida en finca falta el **potrero donde está el ganado** y la **sanidad**.

Con las ventas registradas la app ya cierra el ciclo y dice, al vender todo el
lote, si el negocio dio plata: **utilidad neta = ingresos − compra − gastos**.
Lo que falta para la foto completa del negocio son el **costo por kilo
producido** y los **reportes por finca y periodo**.

> ⚠️ Deuda de semántica: el código todavía arrastra el supuesto de que el `Lote`
> es una venta. En particular, el detalle del lote muestra un KPI
> "**Utilidad = valor a pagar − gastos**" (`LoteDetallePage.tsx`), que solo tiene
> sentido si "valor a pagar" fuera un ingreso. Como es una compra, ese número no
> significa nada y hay que quitarlo/arreglarlo al limpiar la semántica.

## El modelo objetivo: ciclo de vida del lote de ceba

El corazón de la app es **"el lote que compré y estoy engordando"**, con tres
momentos. Hoy existen el primero (la compra), el tercero (la venta) y, del
segundo, los **pesajes → GMD**:

```
   COMPRA (feria/subasta)  →   CEBA en la finca    →    VENTA en feria
   [YA EXISTE]                 [EN CURSO]               [YA EXISTE]
   fecha, n° feria, n° lote,   pesajes → GMD ✅,        peso salida, $/kg,
   sexo, cantidad, peso,       potrero + rotación,      deducción, recibido;
   valor $/kg, valor a pagar   sanidad [FALTA]          parcial ✅
```

Al cerrarse el lote, la app calcula lo que **ninguna planilla del campo da hoy**:
**utilidad real** = ventas − compra − gastos, y **costo por kilo producido**.

### Decisiones de diseño (validadas con el campo)

- **Se mantiene la palabra "Lote".** Es el vocabulario del campo (subasta, finca
  y feria lo llaman lote). El `Lote` actual ya guarda la **compra**; se **expande**
  para agregarle la vida en finca (pesajes, potrero, sanidad) y la venta. No se
  inventa una entidad "Grupo".
- **Manejo por GRUPO, no por orejera.** El cuidador pesa el lote completo y
  registra **una fila: fecha + cantidad + peso total**; la app calcula promedio y
  GMD. El `Animal` individual queda solo para casos especiales (animal enfermo en
  tratamiento, baja por muerte). Esto mantiene el celular simple.
- **El peso de entrada es OPCIONAL.** En subasta a veces pesan en báscula y a
  veces venden "por cabeza" sin pesar. Si se obliga, nadie registra la compra. Si
  hay peso de entrada, el GMD arranca desde la compra; si no, desde el primer
  pesaje en finca.
- **La venta parcial es la norma.** Un lote tiene **1 entrada y N salidas** (se
  sacan los más gordos y se deja el resto cebando). El lote queda **abierto**
  hasta que cantidad vendida = cantidad comprada.
- **Limpiar para ceba pura.** Los códigos de sexo `VP`/`HV`/`TO` y la lógica de
  crías (`criasMacho`/`criasHembra`) son de ganadería de cría. No se borran del
  esquema todavía, pero **se ocultan de los formularios** de ceba (en la subasta
  de engorde se compra `ML` o `MC`).

## Prioridad de las próximas funcionalidades

Orden recomendado. Cada paso entrega valor por sí solo y habilita el siguiente.

> **Punto de partida (ya en la app):** la **compra** del lote. Ese dato ya existe
> (es la planilla de feria que se importa por OCR). Lo que falta es **limpiar su
> semántica**: el código y la UI todavía hablan de "venta/entrega a feria" y hay
> un KPI que calcula "utilidad = valor a pagar − gastos" (válido solo para una
> venta). Relabelar a compra y arreglar/quitar ese KPI es trabajo de limpieza, no
> una feature nueva — conviene hacerlo junto con el paso 1.

### 1. Pesajes del grupo en el tiempo + GMD — *mediana* — ✅ **HECHO**
Tabla sencilla por lote: fecha, cantidad pesada, peso total → la app calcula
promedio por cabeza y la **ganancia media diaria (GMD)** entre pesajes
consecutivos. Registro rápido desde el celular (fecha + peso total, la cantidad
viene precargada). Como la compra guarda el peso de entrada, la GMD arranca desde
la compra cuando existe; si no, desde el primer pesaje en finca.

Entregado (modelo `Pesaje`, endpoints `POST/DELETE /api/pesajes`, sección
"Pesajes y GMD" en el detalle del lote). Validado con el campo: el número grande
son los **kilos ganados** por cabeza y el **peso promedio actual**; la GMD en
g/día queda como dato de apoyo. Se avisa de pesar siempre en las mismas
condiciones (ayuno) y se marca cuando un pesaje tiene cantidad distinta a la del
lote (venta parcial o baja).

> Por qué importa: la diferencia entre 600 g/día y 900 g/día de GMD en un lote de
> 22 novillos, sobre 90 días y a ~8.200 $/kg, vale **más de 4 millones de pesos**.
> Mostrarle eso al dueño en tiempo real justifica construir bien este módulo.

### 2. Vínculo lote ↔ potrero (con rotaciones) — *mediana* — **siguiente**
El potrero ya existe; falta el vínculo "este lote está en este potrero" y el
historial de rotaciones. Corresponde a la **Fase 4 de `docs/potreros-epica.md`**.
El potrero sabe qué lote tiene adentro y por cuánto tiempo → base del semáforo
de rotación (Fase 3 de esa épica: aforo, días de descanso, alerta de
sobrepastoreo).

### 3. Venta del lote en feria (puede ser parcial) — *mediana* — ✅ **HECHO**
Entregado (modelo `Venta`, endpoints `POST/DELETE /api/ventas`, sección "Ventas"
en el detalle del lote). Cada salida guarda fecha, cabezas, peso de salida
(opcional: en feria a veces se vende por cabeza sin báscula), valor, deducción y
valor recibido, más comprador y nota opcionales. Un lote tiene **varias salidas**;
`cantidad` sigue siendo lo comprado y las cabezas en finca salen de restarle las
ventas. El lote se cierra cuando cantidad vendida = cantidad comprada.

También se puede **marcar vendido un animal individual** (el caso de sacar una
sola cabeza): la venta lo apunta, esa cabeza descuenta del lote y el animal queda
con su fecha y su plata. Vender es plata, así que —como los demás valores
comerciales— solo lo hace el **dueño**; el cuidador las ve pero no las registra.

### 4. Cierre del lote y utilidad real — *chica* — **parcial**
Al cerrarse el lote ya se muestran **inversión total** (compra + gastos de ceba),
**ingresos totales** (todas las ventas) y **utilidad neta**. Falta el **costo por
kilo producido**, que cruza los pesajes con la inversión.

### 5. Sanidad — *mediana*
Eventos de sanidad por lote: fecha, tipo (vacuna / desparasitación /
tratamiento), producto, dosis, quién aplicó, cabezas tratadas. En Córdoba la
aftosa (abril y octubre) es obligación legal del ICA. Importante para el
cuidador, pero no es lo que el dueño revisa primero para decidir el negocio →
va después del núcleo del ciclo. Empezar simple, sin detalle por animal.

### 6. Reportes de rentabilidad por finca y periodo — *chica*
Sobre datos ya capturados: lotes cerrados en un rango de fechas, cabezas,
ingresos, gastos, utilidad neta. Exportable como **PDF o imagen para compartir
por WhatsApp/Telegram** con el contador o el socio.

## Notificaciones (enfoque definido)

No es un módulo aparte priorizado, sino el **canal de salida** que hace útiles
las alertas (rotación de potrero, vencimiento de vacuna, sugerencia de venta):

- **Push en la PWA**: la app ya es PWA instalable; las notificaciones se entregan
  como **web push** dentro de la PWA instalada.
- **Telegram por cliente**: además, se puede **configurar un canal de Telegram
  por cliente** para recibir las alertas ahí. (Se configura por cliente, no es
  obligatorio para todos.)

> No se construye un sistema de notificaciones genérico y sobre-configurable.
> Los canales son estos dos: PWA push y Telegram por cliente.

## Lo que NO se construye (para este negocio)

- **Reproducción** (montas, palpaciones, partos, destetes): no hay cría.
- **Animal individual con orejera como flujo principal**: el manejo es por grupo;
  lo individual queda solo para enfermos y bajas.
- **Inseminación artificial** con registros de pajillas/toros donantes: es para
  haciendas con mejoramiento genético, no para ceba.
- **Export a Excel con fórmulas/varias pestañas**: nadie lo abre en el campo;
  mejor PDF/imagen para WhatsApp/Telegram.
- **Más inversión en el mapa visual de potreros**: ya está entregado (Fases 1–2);
  lo que falta es el dato de rotación (paso 2), no más editor visual.

## Referencias

- Estado actual completo: `README.md`.
- Visión y fases de potreros: `docs/potreros-epica.md` (Fases 3–4 se materializan
  en el paso 2 de este roadmap).
