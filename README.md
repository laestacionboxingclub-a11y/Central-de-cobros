# Central de Cobros

Sistema de punto de venta multi-tenant para verdulerías. Este repo contiene las 3 apps del sistema y el código compartido entre ellas.

**Estado actual: Paso 7 (panel central).** Las 6 fases de la Fase 1 del plan están completas — falta la prueba piloto con un cliente real (Paso 8).

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
2. **Catálogo**: lista los productos cargados de esa verdulería, con buscador y foto (si el producto tiene una cargada; si no, muestra un ícono genérico).
3. **Carrito**: tocar un producto abre un teclado numérico grande (tipo balanza) para cargar la cantidad exacta, con atajos para pesos/cantidades comunes. Tocar la cantidad de una línea ya agregada la vuelve a abrir para corregirla. El teclado muestra el stock disponible de ese producto y no deja cargar más de lo que hay: si se pide más cantidad de la que queda, la ajusta sola al máximo disponible y avisa con un mensaje; si no queda nada, directamente no deja agregarlo. El stock que usa para este control es el mismo que ve el dueño en su panel (Paso 6), y se actualiza al toque después de cada venta para que, si se encadenan varias ventas seguidas del mismo producto, cada una vea lo que dejó la anterior.
4. **Cobro**: elegir método de pago (efectivo, posnet o transferencia) y confirmar. Al cobrar se ve una animación de "ticket saliendo de la impresora" — con el contenido real del comprobante impreso ahí mismo (no un cartel en blanco) y un cabezal verde que "escanea" el papel — antes de mostrar el comprobante final. Hay animaciones chicas en varios lugares más (el carrito, los botones, el teclado) para que se sienta más vivo; todas respetan la preferencia "reducir movimiento" del sistema operativo, para quien la tenga activada.
5. **Comprobante**: se muestra en pantalla con formato de ticket y un botón "Imprimir" que abre el diálogo de impresión del navegador/tablet (todavía no manda comandos a una impresora térmica específica — eso se ajusta más adelante según el modelo real que tenga cada cliente).

Detalle técnico importante: registrar una venta (la venta + sus líneas + los movimientos de stock) es **una sola operación atómica** en la base de datos — o se guarda todo, o no se guarda nada. Está implementado como una función de Postgres (`registrar_venta`, en [`supabase/migrations/0002_registrar_venta.sql`](supabase/migrations/0002_registrar_venta.sql)) para evitar que quede una venta a medias si se corta la conexión en el momento exacto de cobrar.

Como con el Paso 2, para aplicar esto a tu proyecto hay que correr ese archivo en el **SQL Editor** de Supabase (el mismo lugar de siempre). También hay una migración chica más ([`0003_productos_foto.sql`](supabase/migrations/0003_productos_foto.sql)) que agrega la columna de foto a los productos — se corre igual. Cargar la foto de cada producto todavía se hace a mano por SQL (`update productos set foto_url = '...' where id = '...'`); una pantalla para subirla desde el panel del dueño es un lindo agregado para el Paso 6.

### Para probar una venta real

Hace falta un usuario con rol `dueno` o `cajero` (tu usuario actual es `superadmin`, que no tiene acceso ni a la app de Caja ni al Panel del Dueño a propósito). Con ese usuario podés cargar productos vos mismo desde el Panel del Dueño (Paso 6) en vez de por SQL.

## Modo offline (Paso 5)

Si a la tablet se le corta el internet en medio del día, la app de Caja sigue funcionando:

- **Vender sin conexión**: si al cobrar no se puede llegar a Supabase, la venta se guarda en la memoria de la tablet (no se pierde) y el comprobante se imprime igual — la plata ya cambió de mano, no tiene sentido hacer esperar al cliente. En la pantalla del comprobante aparece un aviso de "pendiente de sincronizar".
- **Catálogo sin conexión**: la primera vez que la app carga los productos con internet, los guarda en la tablet. Si después se corta la conexión, sigue mostrando ese catálogo (con un aviso de que es una copia guardada) en vez de trabarse.
- **Iniciar sesión sin conexión**: si la tablet ya inició sesión antes, puede seguir entrando aunque no haya internet en ese momento (usa los datos guardados del último ingreso).
- **Sincronización automática**: apenas vuelve la conexión (o cada 30 segundos, por las dudas), la app manda sola las ventas pendientes a Supabase. También hay un botón "Sincronizar ahora" para forzarlo. Una barra arriba de la pantalla siempre muestra "En línea" o "Sin conexión", y cuántas ventas quedan pendientes.
- **Sin duplicados**: como cada venta ya se identifica con un código único generado en la propia tablet (ver Paso 2), sincronizar una venta más de una vez no genera un cobro doble — la base de datos la reconoce y la descarta.

Esto es puramente del lado de la app (no hace falta correr nada nuevo en Supabase para este paso). Probé toda la lógica (encolar una venta, el aviso de pendiente, la barra de conexión, la sincronización automática al reconectar) con datos de prueba. Lo único que no pude probar yo mismo es el caso 100% real (una tablet tuya, en modo avión, vendiendo) — si en algún momento querés confirmarlo con tus propios ojos: abrí la app, poné la tablet en modo avión, hacé una venta (se imprime igual, con el aviso), volvé a activar internet, y en unos segundos debería desaparecer el aviso de pendiente solo.

## Panel del dueño (Paso 6)

Ya no hace falta tocar SQL a mano para cargar productos: el Panel del Dueño tiene 6 pestañas:

- **Productos**: crear, editar, activar/desactivar. Cada uno con nombre, precio, unidad (kg, unidad, cajón, bulto, saco, etc. — es texto libre, no una lista cerrada) y un "stock mínimo" opcional. Si el stock actual de un producto activo cae por debajo de ese mínimo, aparece un aviso arriba de la lista — esa es la alerta de stock bajo. También se puede **ajustar el precio a varios productos a la vez**: se seleccionan con los checkboxes (o "Seleccionar todos") y se les aplica un porcentaje — positivo para subir, negativo para bajar — de una sola vez, en vez de entrar producto por producto.
- **Stock**: cargar mercadería nueva, registrar una merma/pérdida, o hacer un ajuste manual. Se ve el stock actual de cada producto antes de tocarlo.
- **Clientes**: cuenta corriente. Se cargan los clientes habituales (nombre y teléfono opcional) y se ve cuánto debe cada uno, ordenados por el que más debe primero. Al entrar a un cliente se ve su historial completo (cada venta a cuenta y cada pago) y se puede registrar un pago para descontarle el saldo. Si el cliente tiene teléfono cargado, hay un botón para mandarle un recordatorio de cobro directo por WhatsApp (con el saldo ya escrito en el mensaje). Ver también la sección "Cuenta corriente" más abajo.
- **Gastos**: cargar gastos (fecha, categoría, descripción, monto) y ver el historial.
- **Cierres**: el historial de cierres de caja con arqueo — ver la sección más abajo.
- **Reportes**: total vendido, cantidad de ventas, desglose por método de pago, total de gastos y el resultado (ventas − gastos), con períodos rápidos (hoy / esta semana / este mes) o un rango de fechas a elección. Además:
  - **Por caja**: elegís una caja específica (no es solo una lista) y ves su propio detalle — ventas, total, efectivo acumulado, gráfico por día, método de pago y productos más vendidos de esa caja en particular. También queda la vista "Todas" para comparar todas juntas de un vistazo.
  - **Por cajero**: cuánto vendió cada persona.
  - **Productos más vendidos**: top 10 por cantidad vendida.
  - **Gráfico de ventas por día**: un vistazo rápido de cómo viene el período.
  - **Comparación con el período anterior**: "▲ 17% vs. período anterior" al lado del total vendido (mismo largo de período, inmediatamente antes).
  - **Descargar CSV**: baja todo el reporte del período elegido en un archivo para abrir en Excel/Sheets.

### Cuenta corriente

Pensado para el caso típico de un puesto mayorista: venderle a un comerciante conocido que paga después, no en el momento. En la app de Caja, "Cuenta corriente" es un método de pago más — al elegirlo, pide seleccionar a qué cliente se le carga (o crear uno nuevo ahí mismo, sin salir de la pantalla de cobro). La venta se registra igual que cualquier otra; además, se le suma un cargo a la cuenta de ese cliente. Si en ese momento no hay conexión, el cargo se guarda en la tablet y se sincroniza solo cuando vuelve — igual que ya pasa con las ventas.

En el Panel del Dueño (pestaña **Clientes**) se ve cuánto debe cada uno, su historial completo de cargos y pagos, y se registran los pagos que van haciendo para descontarles el saldo.

Corre sobre las mismas reglas que el resto del sistema: `clientes` y `cuenta_corriente_movimientos` (migración [`0006_cuenta_corriente.sql`](supabase/migrations/0006_cuenta_corriente.sql)) están aisladas por tenant con RLS, y el saldo se calcula sumando el historial de movimientos — nunca se guarda como un número que se pisa, mismo criterio que el stock.

### Cierre de caja con arqueo

Desde la app de Caja, un botón "Cerrar caja" en el encabezado calcula cuánto efectivo debería haber (la suma de las ventas en efectivo de esa caja desde el último cierre, o desde siempre si nunca se cerró) y le pide al cajero que cuente el efectivo real y lo escriba. Muestra al toque si falta, sobra o coincide, y guarda el cierre — no bloquea la caja, es solo un control puntual que se puede hacer las veces que se quiera (al final del turno, por ejemplo).

El dueño ve el historial completo de estos cierres en la pestaña **Cierres** del panel: fecha, caja, lo esperado, lo contado y la diferencia — para notar patrones (una caja que siempre da faltante, por ejemplo) sin tener que estar presente en el momento del arqueo. Migración [`0007_cierres_caja.sql`](supabase/migrations/0007_cierres_caja.sql).

### Alertas de stock bajo por email

Además del aviso que ya se ve dentro del panel (pestaña Productos), hay una función que corre sola **una vez por día** y le manda un email al dueño de cada verdulería si algún producto quedó por debajo de su stock mínimo. El código está en [`supabase/functions/alertas-stock/index.ts`](supabase/functions/alertas-stock/index.ts).

Esto es infraestructura de verdad (no solo código de la app), así que hace falta un servicio externo para mandar los mails: [Resend](https://resend.com) (tiene plan gratuito). Son varios pasos manuales, uno solo, no hay que repetirlos:

1. **Creá una cuenta en [resend.com](https://resend.com)** (gratis) y andá a **API Keys → Create API Key**. Copiá la clave (empieza con `re_...`).
2. **Creá la función en Supabase**: en tu proyecto, andá a **Edge Functions → Deploy a new function**, ponele el nombre `alertas-stock`, y pegá el contenido completo de `supabase/functions/alertas-stock/index.ts`. Desplegar.
3. **Cargá el secreto**: en esa misma función, buscá **Secrets** (o **Project Settings → Edge Functions**) y agregá `RESEND_API_KEY` con la clave del paso 1.
4. **Programá que corra sola**: abrí `supabase/migrations/0004_alertas_stock_cron.sql`, reemplazá `TU_SERVICE_ROLE_KEY` por la que está en **Project Settings → API → service_role** (la "secret", no la "anon" — nunca la compartas con nadie más), y corré el archivo completo en el **SQL Editor**. Con eso queda programado para correr todos los días a las 9am (hora Argentina).

**Limitación a tener en cuenta:** mientras no verifiques un dominio propio en Resend, el remitente de prueba (`onboarding@resend.dev`) solo entrega mails a la casilla con la que te registraste en Resend — no a la de cada dueño real. Para que esto funcione con clientes de verdad, en algún momento hay que verificar un dominio (por ejemplo `centraldecobros.com`) en Resend; es un paso más, avisame cuando llegue ese momento y lo hacemos.

No pude probar el envío real de emails yo mismo (necesita tu cuenta de Resend y tu panel de Supabase), así que esta parte conviene que la pruebes vos: una vez armado todo, podés forzar una ejecución manual desde **Edge Functions → alertas-stock → Invoke** para ver si te llega el mail sin esperar al día siguiente.

Como la seguridad de la base ya quedó resuelta en el Paso 2 (cada dueño solo puede tocar los datos de su propia verdulería), esta pantalla no necesitó ninguna migración nueva de Supabase.

## Panel Central (Paso 7)

Tu panel (el único que acepta rol `superadmin`) para administrar todos los clientes desde un solo lugar:

- **Clientes**: lista de todas las verdulerías, con su estado (activo/suspendido), cuántos usuarios tiene, y fecha de alta. Botón para **activar/desactivar el acceso** con un clic — un cliente suspendido no puede entrar ni a la app de Caja ni al Panel del Dueño (el bloqueo ya está en el login de esas apps desde el Paso 3).
- **+ Nuevo cliente**: crea la verdulería (el registro en la base). Importante: esto **no crea el login del dueño** — eso todavía requiere un paso manual en el dashboard de Supabase (ver abajo), porque crear usuarios de verdad necesita una clave que nunca debe estar en una app que corre en el navegador.
- **Ver / Soporte**: entrás a los datos de cualquier cliente sin pedirle nada — usuarios, productos y stock, últimos gastos, ventas de los últimos 7 días. Esto funciona porque las reglas de seguridad del Paso 2 le dan al superadmin acceso a los datos de cualquier tenant, no solo al propio.
- **Vincular usuario existente**: dentro de "Ver / Soporte", conecta un usuario ya creado en Authentication con ese cliente (como dueño o cajero).

### Cómo dar de alta un cliente nuevo, de punta a punta

1. Panel Central → **+ Nuevo cliente** → nombre de la verdulería.
2. Supabase → **Authentication → Users → Add user** → cargá el email y una contraseña para el dueño. Copiá el **UID** que le asigna.
3. Panel Central → entrá a ese cliente con **Ver / Soporte** → **+ Vincular usuario existente** → pegá el UID, el nombre del dueño, rol "Dueño".
4. Listo — el dueño ya puede entrar al Panel del Dueño con el email y contraseña del paso 2.

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
