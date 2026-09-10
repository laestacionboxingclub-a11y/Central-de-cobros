-- Central de Cobros — Atajo de bolsa/cajón
--
-- Hay productos que se venden de dos formas: sueltos por kilo (la unidad
-- real de stock, la que ya tenía cada producto) o enteros por bolsa/cajón
-- a un precio propio (ej: papa suelta por kg, o la bolsa de 25kg entera a
-- un precio que no es necesariamente 25 veces el precio por kg).
--
-- El stock sigue llevándose siempre en kilos — no se duplica ni se separa
-- en dos productos — esto es solo un atajo de carga rápida: "1 bolsa" carga
-- los kilos que corresponden, al precio total que se le puso a la bolsa.

alter table productos add column unidad_alternativa text;
alter table productos add column equivalencia_alternativa numeric(12, 3);
alter table productos add column precio_alternativa numeric(12, 2);

comment on column productos.unidad_alternativa is 'ej: "bolsa", "cajón" — null si el producto no tiene atajo';
comment on column productos.equivalencia_alternativa is 'cuántas unidades de medida (kg) tiene una unidad_alternativa, ej: 25';
comment on column productos.precio_alternativa is 'precio de la unidad_alternativa entera (no siempre equivalencia × precio por kg)';
