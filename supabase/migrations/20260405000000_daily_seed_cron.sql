-- Requires pg_cron and pg_net extensions enabled via Supabase Dashboard:
-- Dashboard > Database > Extensions > search "pg_cron" and "pg_net" > Enable both

-- Schedule daily-seed to run at midnight UTC every day when the hosted-only
-- pg_cron/pg_net schemas are available. Supabase local development uses the
-- CLI's default JWT secret, so only that dev stack is allowed to skip
-- scheduling when the hosted-only schemas are unavailable.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from pg_namespace where nspname = 'net') then
    execute $schedule$
      select cron.schedule(
        'daily-bbs-seed',
        '0 0 * * *',
        $job$
        select net.http_post(
          url := '<YOUR_SUPABASE_URL>/functions/v1/daily-seed',
          headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        );
        $job$
      );
    $schedule$;
  elsif current_setting('app.settings.jwt_secret', true) =
        'super-secret-jwt-token-with-at-least-32-characters-long' then
    raise notice 'Skipping daily-seed cron schedule in local Supabase; pg_cron/pg_net schemas are not available.';
  else
    raise exception 'daily-seed cron requires pg_cron and pg_net schemas. Enable pg_cron and pg_net before applying this migration.';
  end if;
end $$;
