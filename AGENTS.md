# QuotiApp — guía para agentes

SPA de cotizaciones (mayormente servicios, ítems en texto libre) para una sola empresa peruana.
Idioma de la UI y del código de dominio: **español**. Objetivo: **lo más ligera posible**.

## Stack (ya instalado — NO instales paquetes nuevos sin que se pida)
- Vite 8 + React 19 + TypeScript, Tailwind v4, shadcn (style `radix-nova`, alias `@/` → `src/`).
- Componentes shadcn disponibles en `src/components/ui/`: button, input, textarea, label, card, table, dialog, select, badge, dropdown-menu, sonner, separator, alert-dialog. Úsalos; no reescribas primitivas.
- `src/components/theme-provider.tsx` ya existe (tecla `d` alterna oscuro). `sonner.tsx` importa `next-themes`, que NO está instalado: cámbialo para usar `useTheme` de `@/components/theme-provider`.
- Router: `wouter` (no react-router). Páginas con `React.lazy` + `Suspense`.
- Datos: `@supabase/supabase-js`. Cliente único en `src/lib/supabase.ts` leyendo `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- PDF: `jspdf` + `jspdf-autotable`, **solo con `import()` dinámico** dentro de `src/lib/pdf.ts` (no deben entrar al chunk inicial).
- Formularios con estado controlado simple (sin react-hook-form/zod). Iconos: `lucide-react`.

## Contrato de datos
`src/lib/types.ts` es la fuente de verdad de tipos; la migración SQL debe coincidir 1:1 en nombres de columnas.

Tablas (schema public, RLS activo; solo rol `authenticated` puede leer/escribir; `anon` sin acceso):
- `empresa` (una fila, `id = 1`, check id=1): datos emisor, `cuentas_bancarias jsonb` (array de `CuentaBancaria`), `condiciones_default`, `validez_dias_default` (15), `igv_pct` (18), `logo_path` (ruta en bucket `logos`).
- `clientes`: `tipo_doc` ('RUC'|'DNI'), `num_doc` unique.
- `cotizaciones`: `numero` texto único generado por trigger `COT-000001` (sequence), `igv_pct` es snapshot al guardar, `created_by` default `auth.uid()`.
- `cotizacion_items`: FK `on delete cascade`, `orden` int.

RPCs:
- `guardar_cotizacion(p jsonb) returns uuid` — payload `GuardarCotizacionPayload`. Inserta o actualiza cabecera, reemplaza ítems, **recalcula totales en el servidor** (ignora totales del cliente), todo en una transacción. `security invoker`.
- `buscar_cotizaciones(q text default null, desde date default null, hasta date default null, p_estado text default null, lim int default 20, off int default 0)` → filas `CotizacionResumen` (incluye `total_count` vía `count(*) over()`), orden fecha desc, numero desc. `q` busca (ilike, sin acentos si `unaccent` está disponible) en numero, num_doc, razon_social del cliente y descripcion de ítems. Índices `pg_trgm`.

Edge Function `decolecta` (POST `{ numero }`, requiere JWT): 11 dígitos → SUNAT RUC, 8 dígitos → RENIEC DNI, usando secreto `DECOLECTA_TOKEN`. Devuelve `ConsultaDocumento`. El front la llama con `supabase.functions.invoke("decolecta", { body: { numero } })` desde `src/lib/decolecta.ts`.

## Reglas de montos (idénticas en SQL y en `src/lib/money.ts`)
`r2(x)` = redondeo a 2 decimales, mitad hacia arriba.
1. Por línea: `total_linea = r2(cantidad * precio_unitario * (1 - descuento_pct/100))`.
2. `suma_items = Σ total_linea`; `base = suma_items - descuento_global` (descuento_global es un **monto** en la moneda, ≥ 0 y ≤ suma_items).
3. Si `!aplica_igv`: `subtotal = base`, `igv = 0`, `total = base`.
4. Si `aplica_igv && precios_incluyen_igv`: `total = base`, `subtotal = r2(base / (1 + igv_pct/100))`, `igv = total - subtotal`.
5. Si `aplica_igv && !precios_incluyen_igv`: `subtotal = base`, `igv = r2(base * igv_pct/100)`, `total = subtotal + igv`.
Formato de moneda: `Intl.NumberFormat("es-PE", { style: "currency", currency })` → `S/` o `US$`.

## Rutas
`/login`, `/` (lista + buscador), `/cotizaciones/nueva`, `/cotizaciones/:id`, `/cotizaciones/:id/editar`, `/clientes`, `/configuracion`. Todo excepto `/login` requiere sesión.

## Convenciones
- Mobile-first, sin scroll horizontal de página a 360 px (las tablas anchas van dentro de un contenedor con overflow-x).
- Errores al usuario con `toast` de sonner, en español.
- No dejes secretos en el código. `.env` está en `.gitignore`; existe `.env.example`.
- Antes de terminar: `npm run build` debe pasar sin errores de TypeScript.
- No hagas commits.
