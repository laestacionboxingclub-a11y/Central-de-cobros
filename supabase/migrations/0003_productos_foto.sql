-- Central de Cobros — foto de cada producto (para que el catálogo de la app de Caja
-- se reconozca más rápido a simple vista, en vez de solo leer el nombre).
alter table productos add column foto_url text;
