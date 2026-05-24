# Roadmap — miganado

> Última actualización: **2026-05-24**.
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

Hoy la app **solo captura el paso 4** (la venta en feria). El `Lote` nace en la
venta y los `Animal` solo existen dentro de ese lote de venta. No existe el paso
1 (la compra) ni los pasos 2–3 (la vida en la finca: pesajes en el tiempo,
potrero donde está el ganado, sanidad).

Consecuencia: la app es hoy **un libro de ventas, no un sistema de manejo del
hato**. No puede decir si el negocio dio o no dio plata, porque no conoce la
inversión inicial (compra) ni los costos de la ceba.

## El modelo objetivo: ciclo de vida del lote de ceba

El corazón de la app deja de ser "la entrega a feria" y pasa a ser **"el lote
que compré y estoy engordando"**, con tres momentos:

```
   COMPRA (subasta)   →    CEBA en la finca    →    VENTA en feria
   [NUEVO]                 [NUEVO]                  [ya existe]
   fecha, lugar/subasta,   potrero + rotación,      peso venta, $/kg,
   proveedor, cantidad,    pesajes → GMD,           deducción, valor;
   sexo, peso entrada      sanidad, gastos          puede ser PARCIAL
   (opcional), valor compra
```

Al cerrarse el lote, la app calcula lo que **ninguna planilla del campo da hoy**:
**utilidad real** = ventas − compra − gastos, y **costo por kilo producido**.

### Decisiones de diseño (validadas con el campo)

- **Se mantiene la palabra "Lote".** Es el vocabulario del campo (subasta, finca
  y feria lo llaman lote). Se **expande** el `Lote` actual para que tenga compra
  + vida en finca; lo de hoy queda como el momento de venta. No se inventa una
  entidad "Grupo".
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

### 1. Compra / entrada del lote — *mediana*
Dar nacimiento al lote en la compra, no en la venta: fecha, lugar/subasta,
proveedor, cantidad, sexo (`ML`/`MC`), peso de entrada (opcional), valor de
compra ($/kg y/o total). **Es la base de todo el ciclo.** Sin la compra no hay
inversión inicial, no hay utilidad real, no hay nada.

### 2. Pesajes del grupo en el tiempo + GMD — *mediana*
Tabla sencilla por lote: fecha, cantidad pesada, peso total → la app calcula
promedio y la **ganancia media diaria (GMD)** entre pesajes consecutivos.
Registro rápido desde el celular (fecha + peso total, lo demás lo calcula la
app). **Es lo que el dueño mira para decidir cuándo vender.**

> Por qué importa: la diferencia entre 600 g/día y 900 g/día de GMD en un lote de
> 22 novillos, sobre 90 días y a ~8.200 $/kg, vale **más de 4 millones de pesos**.
> Mostrarle eso al dueño en tiempo real justifica construir bien este módulo.

### 3. Vínculo lote ↔ potrero (con rotaciones) — *mediana*
El potrero ya existe; falta el vínculo "este lote está en este potrero" y el
historial de rotaciones. Corresponde a la **Fase 4 de `docs/potreros-epica.md`**.
Con el lote ya con ciclo de vida completo, este vínculo cobra todo su sentido:
el potrero sabe qué lote tiene adentro y por cuánto tiempo → base del semáforo
de rotación (Fase 3 de esa épica: aforo, días de descanso, alerta de
sobrepastoreo).

### 4. Venta parcial — *chica/mediana*
Adaptar el momento de venta para que un lote pueda tener **varias salidas** a
feria, no solo una. El lote se cierra cuando cantidad vendida = cantidad
comprada.

### 5. Cierre del lote y utilidad real — *chica*
Al cerrarse el lote, mostrar: **inversión total** (compra + gastos de ceba),
**ingresos totales** (todas las ventas), **utilidad neta** y **costo por kilo
producido**. Este es el número que el dueño revisa para saber si le fue bien o
mal. Reusa datos ya capturados en los pasos 1, 2 y 4.

### 6. Sanidad — *mediana*
Eventos de sanidad por lote: fecha, tipo (vacuna / desparasitación /
tratamiento), producto, dosis, quién aplicó, cabezas tratadas. En Córdoba la
aftosa (abril y octubre) es obligación legal del ICA. Importante para el
cuidador, pero no es lo que el dueño revisa primero para decidir el negocio →
va después del núcleo del ciclo. Empezar simple, sin detalle por animal.

### 7. Reportes de rentabilidad por finca y periodo — *chica*
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
  lo que falta es el dato de rotación (paso 3), no más editor visual.

## Referencias

- Estado actual completo: `README.md`.
- Visión y fases de potreros: `docs/potreros-epica.md` (Fases 3–4 se materializan
  en el paso 3 de este roadmap).
