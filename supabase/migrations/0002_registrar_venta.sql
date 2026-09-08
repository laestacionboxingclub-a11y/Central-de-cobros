-- Central de Cobros — Paso 4: registrar una venta de forma atómica.
-- La venta, sus líneas y los movimientos de stock se insertan juntos o no se insertan
-- (si falla cualquiera de las tres, no queda ningún rastro parcial).
-- security invoker (default): corre con los permisos del cajero que llama, así que
-- las reglas de RLS de cada tabla se siguen aplicando normalmente.

create or replace function registrar_venta(venta jsonb, items jsonb, movimientos jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  insert into ventas select * from jsonb_populate_record(null::ventas, venta);
  insert into venta_items select * from jsonb_populate_recordset(null::venta_items, items);
  insert into movimientos_stock select * from jsonb_populate_recordset(null::movimientos_stock, movimientos);
end;
$$;

grant execute on function registrar_venta(jsonb, jsonb, jsonb) to authenticated;
