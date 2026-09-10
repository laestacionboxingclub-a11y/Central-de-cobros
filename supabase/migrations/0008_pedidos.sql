-- Central de Cobros — Pedidos (comandas) + precio editable + rol vendedor
--
-- El caso real: en un puesto mayorista, el vendedor de piso le toma el
-- pedido a alguien mientras camina por el local (a un precio que negocian
-- ahí mismo, no un precio fijo de catálogo), le imprime un ticket con un
-- número, y esa persona se acerca después a la caja a pagar y retirar. La
-- caja busca el pedido por número y lo cobra — ahí recién se convierte en
-- una venta de verdad.

-- ============================================================
-- Arreglo pendiente: el método de pago "cuenta_corriente" (agregado hace
-- unos commits) nunca se sumó al check de la tabla ventas. Sin esto,
-- cualquier venta a cuenta corriente real iba a fallar contra la base.
-- ============================================================
alter table ventas drop constraint if exists ventas_metodo_pago_check;
alter table ventas add constraint ventas_metodo_pago_check
  check (metodo_pago in ('efectivo', 'posnet', 'transferencia', 'cuenta_corriente'));

-- ============================================================
-- Rol nuevo: vendedor (toma pedidos en el piso, no maneja caja ni efectivo)
-- ============================================================
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('superadmin', 'dueno', 'cajero', 'vendedor'));

-- ============================================================
-- PEDIDOS (comandas pendientes de cobro)
-- ============================================================
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  numero integer not null, -- se reinicia cada día, solo para poder "llamarlo" fácil
  nombre_referencia text, -- nombre de la persona, opcional
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cobrado', 'cancelado')),
  total numeric(12, 2) not null,
  creado_por uuid references perfiles (id),
  creado_en timestamptz not null default now(),
  cobrado_en timestamptz,
  cobrado_por uuid references perfiles (id),
  venta_id uuid references ventas (id)
);

create index pedidos_tenant_id_idx on pedidos (tenant_id);
create index pedidos_estado_idx on pedidos (tenant_id, estado);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  producto_id uuid not null references productos (id),
  cantidad numeric(12, 3) not null,
  precio_unitario numeric(12, 2) not null, -- el precio que se negoció, no el del catálogo
  subtotal numeric(12, 2) not null
);

create index pedido_items_pedido_id_idx on pedido_items (pedido_id);

-- Crea el pedido + sus líneas en una sola operación, calculando el número
-- del día de forma atómica (para que dos vendedores no choquen el mismo
-- número si toman un pedido al mismo tiempo). security invoker (no
-- definer): corre como el usuario que llama, así las políticas de RLS
-- siguen aplicando igual que si insertara directo en las tablas.
create function crear_pedido(p_tenant_id uuid, p_nombre_referencia text, p_creado_por uuid, p_total numeric, p_items jsonb)
returns pedidos
language plpgsql
security invoker
as $$
declare
  v_numero integer;
  v_pedido pedidos;
begin
  select coalesce(max(numero), 0) + 1 into v_numero
  from pedidos
  where tenant_id = p_tenant_id and creado_en::date = current_date;

  insert into pedidos (tenant_id, numero, nombre_referencia, creado_por, total)
  values (p_tenant_id, v_numero, p_nombre_referencia, p_creado_por, p_total)
  returning * into v_pedido;

  insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
  select v_pedido.id, (item->>'producto_id')::uuid, (item->>'cantidad')::numeric,
         (item->>'precio_unitario')::numeric, (item->>'subtotal')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_pedido;
end;
$$;

-- ============================================================
-- AISLAMIENTO MULTI-TENANT
-- ============================================================
alter table pedidos enable row level security;
alter table pedido_items enable row level security;

create policy pedidos_tenant on pedidos for all
  using (tenant_id = auth_tenant_id() or is_superadmin())
  with check (tenant_id = auth_tenant_id() or is_superadmin());

create policy pedido_items_tenant on pedido_items for all
  using (
    exists (select 1 from pedidos p where p.id = pedido_items.pedido_id and (p.tenant_id = auth_tenant_id() or is_superadmin()))
  )
  with check (
    exists (select 1 from pedidos p where p.id = pedido_items.pedido_id and (p.tenant_id = auth_tenant_id() or is_superadmin()))
  );
