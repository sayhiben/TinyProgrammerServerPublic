-- Requires pg_cron and pg_net extensions enabled via Supabase Dashboard:
-- Dashboard > Database > Extensions > search "pg_cron" and "pg_net" > Enable both

-- Schedule daily-seed to run at midnight UTC every day
-- Replace <YOUR_SUPABASE_URL> and <YOUR_SERVICE_ROLE_KEY> with your own values
select cron.schedule(
  'daily-bbs-seed',
  '0 0 * * *',
  $$
  select net.http_post(
    url := '<YOUR_SUPABASE_URL>/functions/v1/daily-seed',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
