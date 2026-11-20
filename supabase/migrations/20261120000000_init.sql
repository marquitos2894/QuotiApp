create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.empresa (
  id integer primary key default 1 check (id = 1),
  razon_social text not null,
  ruc text not null,
  direccion text,
  telefono text,
  email text,
  web text,
  logo_path text,
  cuentas_bancarias jsonb not null default '[]'::jsonb
    check (pg_catalog.jsonb_typeof(cuentas_bancarias) = 'array'),
  condiciones_default text,
  validez_dias_default integer not null default 15 check (validez_dias_default >= 0),
  igv_pct numeric(5,2) not null default 18 check (igv_pct between 0 and 100),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.clientes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  tipo_doc text not null check (tipo_doc in ('RUC', 'DNI')),
  num_doc text not null unique,
  razon_social text not null,
  direccion text,
  email text,
  telefono text,
  contacto text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.cotizaciones (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  numero text not null unique,
  cliente_id uuid not null references public.clientes (id),
  fecha date not null default current_date,
  validez_dias integer not null default 15 check (validez_dias >= 0),
  moneda text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  aplica_igv boolean not null default true,
  precios_incluyen_igv boolean not null default false,
  igv_pct numeric(5,2) not null default 18 check (igv_pct between 0 and 100),
  descuento_global numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  igv numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada')),
  forma_pago text,
  plazo_entrega text,
  notas text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.cotizacion_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  orden integer not null,
  descripcion text not null check (descripcion ~ '[^[:space:]]'),
  unidad text not null,
  cantidad numeric(14,4) not null check (cantidad > 0 and cantidad <> 'NaN'::numeric),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0 and precio_unitario <> 'NaN'::numeric),
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  total_linea numeric(14,2) not null
);

insert into public.empresa (id, razon_social, ruc)
values (1, 'Mi Empresa', '')
on conflict (id) do nothing;

create sequence if not exists public.cotizacion_numero_seq
  maxvalue 999999 owned by public.cotizaciones.numero;

create or replace function public.asignar_numero_cotizacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.numero := 'COT-' || pg_catalog.lpad(pg_catalog.nextval('public.cotizacion_numero_seq')::text, 6, '0');
  return new;
exception
  when sequence_generator_limit_exceeded then
    raise exception 'Se agotó la numeración de cotizaciones.';
end;
$$;

create or replace trigger asignar_numero_cotizacion
before insert on public.cotizaciones
for each row when (new.numero is null)
execute function public.asignar_numero_cotizacion();

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace trigger actualizar_updated_at before update on public.empresa
for each row execute function public.actualizar_updated_at();
create or replace trigger actualizar_updated_at before update on public.clientes
for each row execute function public.actualizar_updated_at();
create or replace trigger actualizar_updated_at before update on public.cotizaciones
for each row execute function public.actualizar_updated_at();

create index if not exists clientes_razon_social_trgm_idx
  on public.clientes using gin (razon_social extensions.gin_trgm_ops);
create index if not exists clientes_num_doc_trgm_idx
  on public.clientes using gin (num_doc extensions.gin_trgm_ops);
create index if not exists cotizaciones_numero_trgm_idx
  on public.cotizaciones using gin (numero extensions.gin_trgm_ops);
create index if not exists cotizacion_items_descripcion_trgm_idx
  on public.cotizacion_items using gin (descripcion extensions.gin_trgm_ops);
create index if not exists cotizaciones_fecha_idx on public.cotizaciones (fecha desc);
create index if not exists cotizaciones_cliente_id_idx on public.cotizaciones (cliente_id);
create index if not exists cotizacion_items_cotizacion_orden_idx
  on public.cotizacion_items (cotizacion_id, orden);

create or replace function public.r2(numeric)
returns numeric
language sql
immutable strict
set search_path = ''
as $$ select pg_catalog.round($1, 2) $$;

create or replace function public.guardar_cotizacion(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cabecera record;
  item jsonb;
  v_id uuid;
  v_descripcion text;
  v_cantidad numeric(14,4);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_total_linea numeric(14,2);
  v_igv_pct numeric(5,2);
  v_descuento_global numeric(14,2);
  v_suma_items numeric := 0;
  v_base numeric;
  v_subtotal numeric;
  v_igv numeric;
  v_total numeric;
begin
  if pg_catalog.jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Los datos de la cotización son inválidos.';
  end if;
  if pg_catalog.jsonb_typeof(p->'items') is distinct from 'array' then
    raise exception 'La cotización debe tener al menos un ítem.';
  end if;
  if pg_catalog.jsonb_array_length(p->'items') = 0 then
    raise exception 'La cotización debe tener al menos un ítem.';
  end if;

  select * into cabecera
  from pg_catalog.jsonb_to_record(p) as datos(
    id uuid, cliente_id uuid, fecha date, validez_dias integer, moneda text,
    aplica_igv boolean, precios_incluyen_igv boolean, igv_pct numeric,
    descuento_global numeric, estado text, forma_pago text, plazo_entrega text, notas text
  );

  if cabecera.igv_pct is null or not (cabecera.igv_pct between 0 and 100) then
    raise exception 'El porcentaje de IGV debe estar entre 0 y 100.';
  end if;
  if cabecera.descuento_global is null or not (cabecera.descuento_global >= 0)
    or cabecera.descuento_global in ('NaN'::numeric, 'Infinity'::numeric) then
    raise exception 'El descuento global debe ser un monto mayor o igual a cero.';
  end if;
  v_igv_pct := cabecera.igv_pct;
  v_descuento_global := cabecera.descuento_global;

  if cabecera.id is null then
    insert into public.cotizaciones (
      cliente_id, fecha, validez_dias, moneda, aplica_igv, precios_incluyen_igv,
      igv_pct, descuento_global, estado, forma_pago, plazo_entrega, notas
    ) values (
      cabecera.cliente_id, cabecera.fecha, cabecera.validez_dias, cabecera.moneda,
      cabecera.aplica_igv, cabecera.precios_incluyen_igv, v_igv_pct,
      v_descuento_global, cabecera.estado, cabecera.forma_pago, cabecera.plazo_entrega, cabecera.notas
    ) returning id into v_id;
  else
    -- La actualización bloquea la cabecera antes de reemplazar sus ítems.
    update public.cotizaciones c set
      cliente_id = cabecera.cliente_id,
      fecha = cabecera.fecha,
      validez_dias = cabecera.validez_dias,
      moneda = cabecera.moneda,
      aplica_igv = cabecera.aplica_igv,
      precios_incluyen_igv = cabecera.precios_incluyen_igv,
      igv_pct = v_igv_pct,
      descuento_global = v_descuento_global,
      estado = cabecera.estado,
      forma_pago = cabecera.forma_pago,
      plazo_entrega = cabecera.plazo_entrega,
      notas = cabecera.notas
    where c.id = cabecera.id
    returning c.id into v_id;

    if not found then
      raise exception 'No se encontró la cotización que deseas editar.';
    end if;
    delete from public.cotizacion_items i where i.cotizacion_id = v_id;
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p->'items') loop
    v_descripcion := item->>'descripcion';
    if pg_catalog.jsonb_typeof(item->'descripcion') is distinct from 'string'
      or v_descripcion !~ '[^[:space:]]' then
      raise exception 'Cada ítem debe tener una descripción.';
    end if;
    if pg_catalog.jsonb_typeof(item->'cantidad') is distinct from 'number' then
      raise exception 'La cantidad de cada ítem debe ser mayor a cero.';
    end if;
    v_cantidad := (item->>'cantidad')::numeric;
    if v_cantidad <= 0 then
      raise exception 'La cantidad de cada ítem debe ser mayor a cero.';
    end if;
    if pg_catalog.jsonb_typeof(item->'precio_unitario') is distinct from 'number'
      or (item->>'precio_unitario')::numeric < 0 then
      raise exception 'El precio unitario debe ser mayor o igual a cero.';
    end if;
    if pg_catalog.jsonb_typeof(item->'descuento_pct') is distinct from 'number'
      or not ((item->>'descuento_pct')::numeric between 0 and 100) then
      raise exception 'El descuento de cada ítem debe estar entre 0 y 100.';
    end if;

    v_precio := (item->>'precio_unitario')::numeric;
    v_descuento_pct := (item->>'descuento_pct')::numeric;
    v_total_linea := public.r2(v_cantidad * v_precio * (1 - v_descuento_pct / 100));
    v_suma_items := v_suma_items + v_total_linea;

    insert into public.cotizacion_items (
      cotizacion_id, orden, descripcion, unidad, cantidad, precio_unitario, descuento_pct, total_linea
    ) values (
      v_id, (item->>'orden')::integer, v_descripcion, item->>'unidad',
      v_cantidad, v_precio, v_descuento_pct, v_total_linea
    );
  end loop;

  if cabecera.descuento_global > v_suma_items then
    raise exception 'El descuento global no puede superar la suma de los ítems.';
  end if;

  v_base := v_suma_items - v_descuento_global;
  if not cabecera.aplica_igv then
    v_subtotal := v_base;
    v_igv := 0;
    v_total := v_base;
  elsif cabecera.precios_incluyen_igv then
    v_total := v_base;
    v_subtotal := public.r2(v_base / (1 + v_igv_pct / 100));
    v_igv := v_total - v_subtotal;
  else
    v_subtotal := v_base;
    v_igv := public.r2(v_base * v_igv_pct / 100);
    v_total := v_subtotal + v_igv;
  end if;

  update public.cotizaciones c set subtotal = v_subtotal, igv = v_igv, total = v_total
  where c.id = v_id;

  return v_id;
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'La cotización contiene un valor con formato inválido.';
  when numeric_value_out_of_range then
    raise exception 'La cotización contiene un número fuera del rango permitido.';
  when not_null_violation or check_violation then
    raise exception 'La cotización contiene campos obligatorios incompletos o inválidos.';
  when foreign_key_violation then
    raise exception 'No se encontró el cliente o usuario de la cotización.';
end;
$$;

create or replace function public.buscar_cotizaciones(
  q text default null,
  desde date default null,
  hasta date default null,
  p_estado text default null,
  lim integer default 20,
  off integer default 0
)
returns table (
  id uuid,
  numero text,
  fecha date,
  moneda text,
  total numeric,
  estado text,
  cliente_id uuid,
  cliente_razon_social text,
  cliente_num_doc text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtro as (
    select '%' || extensions.unaccent(pg_catalog.lower(nullif(pg_catalog.btrim(q), ''))) || '%' as patron
  )
  select c.id, c.numero, c.fecha, c.moneda, c.total, c.estado, cl.id, cl.razon_social,
    cl.num_doc, pg_catalog.count(*) over ()
  from public.cotizaciones c
  join public.clientes cl on cl.id = c.cliente_id
  cross join filtro f
  where (desde is null or c.fecha >= desde)
    and (hasta is null or c.fecha <= hasta)
    and (p_estado is null or c.estado = p_estado)
    and (
      f.patron is null
      or extensions.unaccent(pg_catalog.lower(c.numero)) like f.patron
      or extensions.unaccent(pg_catalog.lower(cl.num_doc)) like f.patron
      or extensions.unaccent(pg_catalog.lower(cl.razon_social)) like f.patron
      or exists (
        select 1 from public.cotizacion_items i
        where i.cotizacion_id = c.id
          and extensions.unaccent(pg_catalog.lower(i.descripcion)) like f.patron
      )
    )
  order by c.fecha desc, c.numero desc
  limit greatest(coalesce(lim, 20), 0) offset greatest(coalesce(off, 0), 0);
$$;

alter table public.empresa enable row level security;
alter table public.clientes enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;

drop policy if exists empresa_select on public.empresa;
create policy empresa_select on public.empresa for select to authenticated using (true);
drop policy if exists empresa_update on public.empresa;
create policy empresa_update on public.empresa for update to authenticated using (true) with check (true);

drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select to authenticated using (true);
drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes for insert to authenticated with check (true);
drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes for update to authenticated using (true) with check (true);
drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes for delete to authenticated using (true);

drop policy if exists cotizaciones_select on public.cotizaciones;
create policy cotizaciones_select on public.cotizaciones for select to authenticated using (true);
drop policy if exists cotizaciones_insert on public.cotizaciones;
create policy cotizaciones_insert on public.cotizaciones for insert to authenticated with check (true);
drop policy if exists cotizaciones_update on public.cotizaciones;
create policy cotizaciones_update on public.cotizaciones for update to authenticated using (true) with check (true);
drop policy if exists cotizaciones_delete on public.cotizaciones;
create policy cotizaciones_delete on public.cotizaciones for delete to authenticated using (true);

drop policy if exists cotizacion_items_select on public.cotizacion_items;
create policy cotizacion_items_select on public.cotizacion_items for select to authenticated using (true);
drop policy if exists cotizacion_items_insert on public.cotizacion_items;
create policy cotizacion_items_insert on public.cotizacion_items for insert to authenticated with check (true);
drop policy if exists cotizacion_items_update on public.cotizacion_items;
create policy cotizacion_items_update on public.cotizacion_items for update to authenticated using (true) with check (true);
drop policy if exists cotizacion_items_delete on public.cotizacion_items;
create policy cotizacion_items_delete on public.cotizacion_items for delete to authenticated using (true);

revoke all on public.empresa, public.clientes, public.cotizaciones, public.cotizacion_items
  from public, anon, authenticated;
grant usage on schema public, extensions to authenticated;
grant select, update on public.empresa to authenticated;
grant select, insert, update, delete on public.clientes, public.cotizaciones, public.cotizacion_items
  to authenticated;

revoke all on sequence public.cotizacion_numero_seq from public, anon, authenticated;
grant usage on sequence public.cotizacion_numero_seq to authenticated;

revoke execute on function public.actualizar_updated_at(), public.asignar_numero_cotizacion(),
  public.r2(numeric), public.guardar_cotizacion(jsonb),
  public.buscar_cotizaciones(text, date, date, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.r2(numeric), public.guardar_cotizacion(jsonb),
  public.buscar_cotizaciones(text, date, date, text, integer, integer) to authenticated;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

drop policy if exists logos_select on storage.objects;
create policy logos_select on storage.objects for select to authenticated using (bucket_id = 'logos');
drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects for insert to authenticated with check (bucket_id = 'logos');
drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos') with check (bucket_id = 'logos');
drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects for delete to authenticated using (bucket_id = 'logos');
