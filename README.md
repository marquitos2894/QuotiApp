# QuotiApp

Aplicación web interna para que una empresa peruana gestione clientes y cotizaciones de servicios. Permite cotizar en soles o dólares, aplicar descuentos e IGV, consultar documentos de clientes y generar PDF. La interfaz usa React y Vite. Supabase gestiona las sesiones, la base de datos y el almacenamiento de logos.

## Desarrollo local

1. Instala las dependencias con `npm i`.
2. Copia `.env.example` a `.env`. Completa `VITE_SUPABASE_URL` con la URL del proyecto y `VITE_SUPABASE_PUBLISHABLE_KEY` con su clave publicable. El proyecto debe tener la migración aplicada y un usuario creado.
3. Ejecuta `npm run dev` y abre la URL que muestra Vite.

## Despliegue de Supabase

1. Crea un proyecto de Supabase con Postgres 17 y copia su referencia en el panel.
2. Desde la raíz del repositorio, inicia sesión y vincula el proyecto. Sustituye `<ref>` por la referencia que copiaste.

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   ```

3. Aplica la migración al proyecto vinculado. Usa `--remote` con la CLI v3. En la CLI v2, `npx supabase db push` ya apunta al proyecto vinculado.

   ```bash
   npx supabase db push --remote
   ```

4. Configura el secreto con el token de Decolecta y despliega la función.

   ```bash
   npx supabase secrets set DECOLECTA_TOKEN=<token>
   npx supabase functions deploy decolecta
   ```

5. En **Authentication → Users**, selecciona **Add user → Create new user**. Ingresa el correo y la contraseña del primer usuario. Confirma el correo desde el panel si quieres habilitar el acceso de inmediato.
6. En los ajustes de **Authentication**, desactiva **Allow new users to sign up**. Mantén desactivada la opción **Allow anonymous sign-ins**. En **Authentication → URL Configuration**, establece **Site URL** con la URL pública de QuotiApp, por ejemplo `https://cotizaciones.example.com`.

Consulta la [guía de la CLI para proyectos vinculados](https://supabase.com/docs/guides/local-development/local-and-hosted-projects) y los [ajustes de Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).

## Publicación de la aplicación

Configura las dos variables `VITE_SUPABASE_*` para el proyecto de producción antes de ejecutar `npm run build`. Publica el contenido de `dist/` en un hosting estático o CDN.

Configura el fallback de SPA para servir `/index.html` con estado 200 cuando la ruta solicitada no corresponda a un archivo estático. Así funcionan los enlaces directos y la recarga en rutas como `/clientes` y `/cotizaciones/nueva`.
