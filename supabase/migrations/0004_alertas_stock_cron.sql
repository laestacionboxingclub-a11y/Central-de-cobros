-- Central de Cobros — programa la alerta diaria de stock bajo (ver
-- supabase/functions/alertas-stock/index.ts).
--
-- IMPORTANTE antes de correr esto:
-- 1. Reemplazá TU_SERVICE_ROLE_KEY de más abajo por la que está en tu
--    proyecto de Supabase, en Project Settings -> API -> service_role
--    (la clave "secret", no la "anon"). Nunca se la pases a nadie.
-- 2. Este archivo ya tiene la URL de tu proyecto puesta.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Guarda la service role key en Vault (no queda en texto plano en el cron job).
select vault.create_secret('TU_SERVICE_ROLE_KEY', 'service_role_key');

-- Todos los días a las 12:00 UTC (9:00 de la mañana en Argentina).
select cron.schedule(
  'alertas-stock-diarias',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://ciawkhkxdiqlfxfckpjd.supabase.co/functions/v1/alertas-stock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    )
  );
  $$
);
