-- Central de Cobros — Cuenta corriente
-- Para vender a comerciantes conocidos que pagan después (el caso típico
-- de un puesto mayorista del Mercado Central), en vez de cobrar siempre
-- en el momento.

-- ============================================================
-- CLIENTES (a quién se le puede vender a cuenta)
-- ============================================================
create table clientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nombre text not null,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index clientes_tenant_id_idx on clientes (tenant_id);

-- ============================================================
-- CUENTA_CORRIENTE_MOVIMIENTOS (ledger: nunca se actualiza, solo se agrega)
-- El saldo de un cliente = suma de sus movimientos (ver vista cuenta_corriente_saldo).
-- Mismo patrón que movimientos_stock: positivo = cargo (debe), negativo = pago (abona).
-- ============================================================
create table cuenta_corriente_movimientos (
  id uuid primary key, -- generado en el cliente
  tenant_id uuid not null references tenants (id) on delete cascade,
  cliente_id uuid not null references clientes (id),
  monto numeric(12, 2) not null,
  tipo text not null check (tipo in ('cargo', 'pago')),
  venta_id uuid references ventas (id), -- solo para los cargos que vienen de una venta
  descripcion text,
  creado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);

create index cuenta_corriente_movimientos_tenant_id_idx on cuenta_corriente_movimientos (tenant_id);
create index cuenta_corriente_movimientos_cliente_id_idx on cuenta_corriente_movimientos (cliente_id);

-- Saldo actual por cliente: se calcula, nunca se guarda como número fijo.
create view cuenta_corriente_saldo as
select
  tenant_id,
  cliente_id,
  sum(monto) as saldo
from cuenta_corriente_movimientos
group by tenant_id, cliente_id;

-- ============================================================
-- AISLAMIENTO MULTI-TENANT (mismo patrón que el resto de las tablas)
-- ============================================================
alter table clientes enable row level security;
alter table cuenta_corriente_movimientos enable row level security;

create policy clientes_tenant on clientes for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());

create policy cuenta_corriente_movimientos_tenant on cuenta_corriente_movimientos for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());
