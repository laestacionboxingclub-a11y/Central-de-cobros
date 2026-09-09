-- Central de Cobros — Cierre de caja con arqueo
-- Al terminar el turno, el cajero cuenta el efectivo real y el sistema lo
-- compara contra lo que debería haber (según las ventas en efectivo desde
-- el cierre anterior). Le da al dueño control aunque no esté parado ahí.

create table cierres_caja (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  caja_id uuid not null references cajas (id),
  efectivo_esperado numeric(12, 2) not null,
  efectivo_contado numeric(12, 2) not null,
  diferencia numeric(12, 2) not null,
  cerrado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);

create index cierres_caja_tenant_id_idx on cierres_caja (tenant_id);
create index cierres_caja_caja_id_idx on cierres_caja (caja_id);

alter table cierres_caja enable row level security;

create policy cierres_caja_tenant on cierres_caja for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());
