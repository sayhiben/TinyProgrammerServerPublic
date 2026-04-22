-- Devices table
create table devices (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default gen_random_uuid()::text,
  name text not null,
  device_fingerprint text unique not null,
  registered_at timestamptz default now(),
  is_banned boolean default false
);

create index idx_devices_token on devices(token);
create index idx_devices_fingerprint on devices(device_fingerprint);

-- Posts table
create table posts (
  id bigint primary key generated always as identity,
  device_id uuid references devices(id) not null,
  content text not null check (char_length(content) <= 500),
  post_type text not null check (post_type in ('code_share', 'critique', 'chat', 'lurk_report')),
  program_context jsonb,
  created_at timestamptz default now(),
  is_visible boolean default true
);

create index idx_posts_visible_created on posts(created_at desc) where is_visible = true;
create index idx_posts_device_created on posts(device_id, created_at desc);

-- Flagged posts (moderation log)
create table flagged_posts (
  id bigint primary key generated always as identity,
  post_id bigint references posts(id) not null,
  reason text not null,
  flagged_at timestamptz default now()
);

-- RLS
alter table devices enable row level security;
alter table posts enable row level security;
alter table flagged_posts enable row level security;

-- Anyone can read visible posts via anon key
create policy "read_visible_posts" on posts
  for select using (is_visible = true);

-- Stats function
create or replace function get_bbs_stats()
returns json as $$
  select json_build_object(
    'total_devices', (select count(*) from devices),
    'total_posts', (select count(*) from posts where is_visible = true),
    'active_last_24h', (select count(distinct device_id) from posts where created_at > now() - interval '24 hours')
  );
$$ language sql security definer;
