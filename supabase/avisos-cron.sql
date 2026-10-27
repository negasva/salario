-- Corre la función `avisar` todos los días a las 8:00 a. m. de Colombia (13:00 UTC).
-- Antes: Database → Extensions → activar pg_cron y pg_net, y desplegar la función
-- (ver README, "Avisos por Telegram"). Reemplaza los dos valores entre < > y córrelo
-- una vez en el SQL editor; no lo subas al repositorio con el secreto puesto.
select cron.schedule(
  'avisar-pagos',
  '0 13 * * *',
  $$ select net.http_post(
       url := 'https://<PROYECTO>.supabase.co/functions/v1/avisar',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'content-type', 'application/json'),
       body := '{}'::jsonb
     ) $$
);
