# Central de Cobros

Sistema de punto de venta multi-tenant para verdulerías. Este repo contiene las 3 apps del sistema y el código compartido entre ellas.

**Estado actual: Paso 1 (base técnica).** Todavía no hay pantallas funcionales, ni tablas en la base de datos — eso empieza en el Paso 2.

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

Sin este paso, cada app arranca igual pero muestra "Supabase: sin configurar" en pantalla. Todavía no hay tablas creadas — eso es el Paso 2.

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
