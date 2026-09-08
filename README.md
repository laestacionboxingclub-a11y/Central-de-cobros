# Central de Cobros

Sistema de punto de venta multi-tenant para verdulerías. Este repo contiene las 3 apps del sistema y el código compartido entre ellas.

**Estado actual: Paso 4 (punto de venta).** La app de Caja ya permite vender de verdad: catálogo, carrito, cobro e impresión de comprobante. Todavía no hay modo offline (Paso 5) ni panel del dueño para cargar stock/precios (Paso 6).

## Estructura del proyecto

```
apps/
  caja/            App de caja (PWA) — se instala en cada tablet de la verdulería
  panel-dueno/     Panel donde cada verdulería carga stock, precios, gastos y ve reportes
  panel-central/   Tu panel (súper-admin) para administrar todos los clientes

packages/
  shared/          Tipos y utilidades compartidas entre las 3 apps, incluido el cliente de Supabase
```

Cada app en `apps/` es un proyecto independiente (se instala y se despliega por separado), pero las tres comparten código a través de `packages/shared`.

## Stack elegido

**Vite + React + TypeScript**, en las 3 apps.

En una frase: es la combinación más liviana y rápida para armar una PWA offline-first, con muchísima documentación y todas las librerías de "modo sin conexión" (que vamos a necesitar en el Paso 5) ya pensadas para trabajar con Vite.

TypeScript se usa para que, cuando el proyecto crezca (ventas, stock, dinero de por medio), muchos errores se detecten al escribir el código en vez de en producción — no hace falta que lo entiendas en detalle, es una capa extra de seguridad.

La app de **caja** además tiene instalado `vite-plugin-pwa`, que es lo que la va a dejar "instalable" en la tablet y con soporte para trabajar offline. Por ahora solo está la configuración base (nombre, ícono, colores); la lógica real de guardar ventas sin internet se arma en el Paso 5.

## Supabase (base de datos compartida)

El proyecto ya tiene el cliente de Supabase configurado en `packages/shared/src/supabase/client.ts`, listo para conectarse. Lo que falta —y **no puedo hacer por vos**— es crear el proyecto en Supabase, porque requiere que vos crees la cuenta:

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto gratuito (nombre sugerido: `central-de-cobros`).
2. Andá a **Settings → API** y copiá dos datos: **Project URL** y **anon public key**.
3. En cada carpeta de `apps/` (`caja`, `panel-dueno`, `panel-central`) copiá el archivo `.env.example` a `.env` y pegá ahí esos dos valores:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon
   ```
4. El archivo `.env` nunca se sube a Git (está en `.gitignore`) — son tus claves, no van al repositorio.

Sin este paso, cada app arranca igual pero muestra "Supabase: sin configurar" en pantalla.

## Modelo de datos (Paso 2)

El esquema completo está escrito en [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Son 8 tablas:

| Tabla | Para qué sirve |
|---|---|
| `tenants` | Cada verdulería/cliente que te alquila el sistema. Tiene un estado `activo`/`suspendido` que vos manejás desde el panel central según el pago de la membresía. |
| `perfiles` | Las personas que usan el sistema: dueño, cajero o superadmin (vos). Se completa en el Paso 3 (login). |
| `cajas` | Cada tablet física de una verdulería. |
| `productos` | El catálogo de cada verdulería: nombre, precio, unidad (kg, unidad, etc.). |
| `ventas` | Una fila por venta hecha en una caja. |
| `venta_items` | Los productos de cada venta (líneas del ticket). |
| `movimientos_stock` | El historial de entradas/salidas de stock (cargas, ventas, ajustes, mermas). |
| `gastos` | Los gastos que carga el dueño. |

Dos decisiones importantes, explicadas simple:

- **El stock nunca es "un número que se pisa".** Cada carga de mercadería, cada venta, cada ajuste queda registrado como un movimiento separado (positivo o negativo) en `movimientos_stock`. El stock actual de un producto es la suma de todos sus movimientos (ver la vista `stock_actual`). Así, si dos cajas venden el mismo producto al mismo tiempo estando offline, cuando sincronizan no hay ningún conflicto que resolver: simplemente se suman ambos movimientos.
- **Todos los clientes comparten las mismas tablas, pero aislados.** Cada tabla tiene una columna `tenant_id` y una regla de seguridad (Row Level Security) que hace que cada verdulería solo pueda ver y tocar sus propias filas — a nivel de la base de datos, no solo en la pantalla. Vos (superadmin) sos el único que puede ver todo, para dar soporte.

### Cómo aplicar este modelo a tu base de Supabase

Una vez que tengas el proyecto creado en supabase.com (ver sección anterior):

1. En el panel de Supabase, andá a **SQL Editor** (menú de la izquierda).
2. Abrí el archivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) de este proyecto, copiá todo el contenido y pegalo en el SQL Editor.
3. Apretá **Run**. Se crean las 8 tablas, la vista de stock y las reglas de seguridad, todo de una vez.

Si más adelante cambiamos el modelo, va a aparecer un archivo nuevo `0002_...sql` en la misma carpeta, y se corre de la misma forma.

## Login y roles (Paso 3)

Cada una de las 3 apps ahora pide iniciar sesión (email + contraseña) y solo deja pasar al rol que le corresponde:

- **App de Caja** → acepta `cajero` y `dueno` (el dueño también puede cobrar si hace falta).
- **Panel del Dueño** → acepta solo `dueno`.
- **Panel Central** → acepta solo `superadmin` (vos).

Si alguien entra con un rol que no corresponde a esa app, o si su verdulería está `suspendida` (columna `estado` de `tenants`), ve un mensaje claro en vez de la pantalla normal — nunca llega a ver datos que no le corresponden.

Importante: **esto todavía no se puede probar de verdad** porque no hay un proyecto de Supabase conectado ni usuarios creados. Cuando creemos el proyecto (ver más abajo), para que alguien pueda entrar hace falta:

1. Crear el usuario en **Authentication → Users** del panel de Supabase (con email y contraseña) — esto lo hacés vos por ahora, a mano, para cada dueño/cajero. Automatizar esa alta es el Paso 7 (tu panel central).
2. Crear su fila correspondiente en la tabla `perfiles` (mismo `id` que el usuario, más su `tenant_id` y `rol`) desde el SQL Editor.

Sin esos dos pasos, el login funciona pero la persona ve "no tenés un perfil asignado".

## Punto de venta (Paso 4)

La app de Caja ahora tiene el flujo completo de venta:

1. **Elegir caja**: la primera vez que se abre la app en una tablet, pregunta qué caja es (o deja crear una nueva). Queda guardado en esa tablet — no se vuelve a preguntar.
2. **Catálogo**: lista los productos cargados de esa verdulería, con buscador.
3. **Carrito**: tocar un producto lo agrega (o suma 1 si ya estaba); la cantidad se puede editar a mano, incluso con decimales para productos por kg.
4. **Cobro**: elegir método de pago (efectivo, posnet o transferencia) y confirmar.
5. **Comprobante**: se muestra en pantalla con formato de ticket y un botón "Imprimir" que abre el diálogo de impresión del navegador/tablet (todavía no manda comandos a una impresora térmica específica — eso se ajusta más adelante según el modelo real que tenga cada cliente).

Detalle técnico importante: registrar una venta (la venta + sus líneas + los movimientos de stock) es **una sola operación atómica** en la base de datos — o se guarda todo, o no se guarda nada. Está implementado como una función de Postgres (`registrar_venta`, en [`supabase/migrations/0002_registrar_venta.sql`](supabase/migrations/0002_registrar_venta.sql)) para evitar que quede una venta a medias si se corta la conexión en el momento exacto de cobrar.

Como con el Paso 2, para aplicar esto a tu proyecto hay que correr ese archivo en el **SQL Editor** de Supabase (el mismo lugar de siempre).

### Para probar una venta real

Como todavía no existe el panel del dueño (Paso 6) para cargar productos, hace falta cargar unos productos de prueba a mano por SQL Editor, y tener un usuario con rol `dueno` o `cajero` (tu usuario actual es `superadmin`, que no tiene acceso a la app de Caja a propósito). Cuando quieras hacer esa prueba, avisame y te paso el SQL con los datos de ejemplo.

## Requisito para correr el proyecto: Node.js

Este Mac no tiene **Node.js** instalado (es el programa que permite correr proyectos como este). Hace falta instalarlo una sola vez:

1. Entrá a [nodejs.org](https://nodejs.org) y descargá la versión **LTS** (recomendada).
2. Abrí el instalador descargado y seguí los pasos (te va a pedir tu contraseña de Mac).
3. Cerrá y volvé a abrir la terminal / la app de Claude Code.
4. Confirmá que quedó instalado corriendo:
   ```bash
   node -v
   ```

Una vez instalado eso, avisame y seguimos: instalamos las dependencias del proyecto y lo probamos corriendo en tu máquina.

## Cómo correr cada app en local (una vez instalado Node.js)

Desde la carpeta raíz del proyecto, primero instalá las dependencias de las 3 apps juntas (una sola vez, o cada vez que se agreguen librerías nuevas):

```bash
npm install
```

Después, para levantar cada app en modo desarrollo (podés tener varias abiertas al mismo tiempo, cada una en su propia terminal):

```bash
npm run dev:caja
npm run dev:panel-dueno
npm run dev:panel-central
```

Cada comando te va a dar una dirección local (algo como `http://localhost:5173`) para abrir en el navegador.

## Despliegue en Netlify

Cada app se despliega como un **sitio separado** en Netlify (son 3 sitios, aunque todo viva en el mismo repositorio):

1. En Netlify, "Add new site" → conectar este repositorio de Git.
2. En **Base directory** poner la carpeta de la app correspondiente: `apps/caja`, `apps/panel-dueno` o `apps/panel-central`.
3. Netlify va a leer el `netlify.toml` de esa carpeta automáticamente (ya tiene el comando de build y la carpeta de salida configurados).
4. En **Environment variables** de ese sitio, agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los mismos valores que pusiste en el `.env` local.
5. Repetir para las otras dos apps (son 3 sitios de Netlify independientes, con sus propias variables).

## Control de versiones (Git)

El proyecto ya está inicializado como repositorio Git local, con un primer commit con toda esta base. Cuando quieras subirlo a GitHub (recomendado antes de conectar Netlify), avisame y lo conectamos a un repositorio remoto.
