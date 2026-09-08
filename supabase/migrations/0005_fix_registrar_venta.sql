-- Central de Cobros — arregla registrar_venta (Paso 4).
--
-- Bug: `jsonb_populate_record(null::ventas, venta)` arma la fila usando un
-- registro NULO como base, así que cualquier columna que la tablet no manda
-- (sincronizada_en, sincronizado_en) queda en NULL en vez de usar el
-- `default now()` de la tabla — y como esas columnas son NOT NULL, el INSERT
-- fallaba siempre con "violates not-null constraint".
--
-- Arreglo: insertar con una lista explícita de columnas (solo las que la
-- tablet realmente manda), para que Postgres aplique el default en las que
-- se omiten, como corresponde.

create or replace function registrar_venta(venta jsonb, items jsonb, movimientos jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  insert into ventas (id, tenant_id, caja_id, cajero_id, numero_comprobante, metodo_pago, total, estado, creada_en)
  select id, tenant_id, caja_id, cajero_id, numero_comprobante, metodo_pago, total, estado, creada_en
  from jsonb_populate_record(null::ventas, venta);

  insert into venta_items (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
  select id, venta_id, producto_id, cantidad, precio_unitario, subtotal
  from jsonb_populate_recordset(null::venta_items, items);

  insert into movimientos_stock (id, tenant_id, producto_id, cantidad, tipo, venta_id, caja_id, creado_por, creado_en)
  select id, tenant_id, producto_id, cantidad, tipo, venta_id, caja_id, creado_por, creado_en
  from jsonb_populate_recordset(null::movimientos_stock, movimientos);
end;
$$;
