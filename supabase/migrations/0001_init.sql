-- Central de Cobros — Paso 2: modelo de datos inicial
-- Multi-tenant: cada fila de negocio tiene tenant_id y RLS impide ver datos de otro tenant.
-- Stock: nunca se guarda como número que se pisa, es una suma de movimientos (ver vista stock_actual).

create extension if not exists pgcrypto;

-- ============================================================
-- TENANTS (cada verdulería/cliente que paga la membresía)
-- ============================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  estado text not null default 'activo' check (estado in ('activo', 'suspendido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column tenants.estado is 'activo/suspendido: lo controla el panel central según el pago de la membresía';

-- ============================================================
-- PERFILES (usuarios: dueño, cajero, superadmin) — extiende auth.users
-- ============================================================
create table perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid references tenants (id) on delete cascade,
  rol text not null check (rol in ('superadmin', 'dueno', 'cajero')),
  nombre text not null,
  created_at timestamptz not null default now()
);

comment on column perfiles.tenant_id is 'null solo para superadmin (yo); dueño y cajero siempre pertenecen a un tenant';

create index perfiles_tenant_id_idx on perfiles (tenant_id);

-- ============================================================
-- CAJAS (cada tablet física de una verdulería)
-- ============================================================
create table cajas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index cajas_tenant_id_idx on cajas (tenant_id);

-- ============================================================
-- PRODUCTOS (catálogo de cada verdulería)
-- ============================================================
create table productos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nombre text not null,
  unidad_medida text not null default 'unidad', -- 'kg', 'unidad', 'docena', 'bolsa', etc.
  precio numeric(12, 2) not null default 0,
  stock_minimo numeric(12, 3), -- para alertas de stock bajo (Paso 6)
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index productos_tenant_id_idx on productos (tenant_id);

-- ============================================================
-- VENTAS (una fila por venta hecha en una caja)
-- id generado en la tablet (no en el servidor) para poder vender offline
-- y sincronizar después sin choques: sincronizar = "insertar si no existe".
-- ============================================================
create table ventas (
  id uuid primary key, -- generado en el cliente (tablet), no default acá
  tenant_id uuid not null references tenants (id) on delete cascade,
  caja_id uuid not null references cajas (id),
  cajero_id uuid not null references perfiles (id),
  numero_comprobante text not null, -- ej "Caja 1 - 000123", armado en la tablet
  metodo_pago text not null check (metodo_pago in ('efectivo', 'posnet', 'transferencia')),
  total numeric(12, 2) not null,
  estado text not null default 'completada' check (estado in ('completada', 'anulada')),
  creada_en timestamptz not null, -- hora real de la venta en la tablet (puede ser offline)
  sincronizada_en timestamptz not null default now(), -- hora en que llegó al servidor
  unique (caja_id, numero_comprobante)
);

create index ventas_tenant_id_idx on ventas (tenant_id);
create index ventas_caja_id_idx on ventas (caja_id);

-- ============================================================
-- VENTA_ITEMS (líneas de cada venta)
-- ============================================================
create table venta_items (
  id uuid primary key, -- generado en el cliente, igual que ventas
  venta_id uuid not null references ventas (id) on delete cascade,
  producto_id uuid not null references productos (id),
  cantidad numeric(12, 3) not null,
  precio_unitario numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create index venta_items_venta_id_idx on venta_items (venta_id);

-- ============================================================
-- MOVIMIENTOS_STOCK (ledger: nunca se actualiza, solo se agrega)
-- El stock actual de un producto = suma de sus movimientos (ver vista stock_actual).
-- Esto es lo que permite que varias cajas descuenten stock offline sin pisarse.
-- ============================================================
create table movimientos_stock (
  id uuid primary key, -- generado en el cliente
  tenant_id uuid not null references tenants (id) on delete cascade,
  producto_id uuid not null references productos (id),
  cantidad numeric(12, 3) not null, -- positivo = entra (carga), negativo = sale (venta/merma)
  tipo text not null check (tipo in ('carga', 'venta', 'ajuste', 'merma')),
  venta_id uuid references ventas (id),
  caja_id uuid references cajas (id),
  creado_por uuid references perfiles (id),
  creado_en timestamptz not null, -- hora real del movimiento en el origen (puede ser offline)
  sincronizado_en timestamptz not null default now()
);

create index movimientos_stock_tenant_id_idx on movimientos_stock (tenant_id);
create index movimientos_stock_producto_id_idx on movimientos_stock (producto_id);

-- Stock actual por producto: se calcula, nunca se guarda como número fijo.
create view stock_actual as
select
  tenant_id,
  producto_id,
  sum(cantidad) as stock
from movimientos_stock
group by tenant_id, producto_id;

-- ============================================================
-- GASTOS
-- ============================================================
create table gastos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  fecha date not null,
  categoria text not null,
  descripcion text,
  monto numeric(12, 2) not null,
  creado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);

create index gastos_tenant_id_idx on gastos (tenant_id);

-- ============================================================
-- updated_at automático en tablas que se editan (no en las de solo-agregar)
-- ============================================================
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_set_updated_at before update on tenants
  for each row execute function set_updated_at();

create trigger productos_set_updated_at before update on productos
  for each row execute function set_updated_at();

-- ============================================================
-- AISLAMIENTO MULTI-TENANT (Row Level Security)
-- Todas las verdulerías comparten las mismas tablas, pero cada una
-- solo puede leer/escribir sus propias filas. El superadmin (yo) ve todo.
-- ============================================================
create function auth_tenant_id() returns uuid as $$
  select tenant_id from perfiles where id = auth.uid();
$$ language sql stable security definer;

create function is_superadmin() returns boolean as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'superadmin');
$$ language sql stable security definer;

alter table tenants enable row level security;
alter table perfiles enable row level security;
alter table cajas enable row level security;
alter table productos enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;
alter table movimientos_stock enable row level security;
alter table gastos enable row level security;

-- tenants: cada uno ve solo el suyo; superadmin los ve todos (alta de clientes = Paso 7)
create policy tenants_select on tenants for select
  using (id = auth_tenant_id() or is_superadmin());
create policy tenants_all_superadmin on tenants for all
  using (is_superadmin()) with check (is_superadmin());

-- perfiles: uno mismo, el resto de su tenant, o superadmin
create policy perfiles_select on perfiles for select
  using (id = auth.uid() or tenant_id = auth_tenant_id() or is_superadmin());
create policy perfiles_all_superadmin on perfiles for all
  using (is_superadmin()) with check (is_superadmin());

-- resto de tablas: mismo patrón (tenant propio o superadmin)
create policy cajas_tenant on cajas for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());

create policy productos_tenant on productos for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());

create policy ventas_tenant on ventas for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());

create policy venta_items_tenant on venta_items for all
  using (
    exists (select 1 from ventas v where v.id = venta_items.venta_id and (v.tenant_id = auth_tenant_id() or is_superadmin()))
  )
  with check (
    exists (select 1 from ventas v where v.id = venta_items.venta_id and (v.tenant_id = auth_tenant_id() or is_superadmin()))
  );

create policy movimientos_stock_tenant on movimientos_stock for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());

create policy gastos_tenant on gastos for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());
