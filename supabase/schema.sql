create table perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nombre text not null,
  data jsonb not null,          -- ingreso, moneda, items, metas, bloqueos
  updated_at timestamptz default now()
);

create table cierres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  perfil_id uuid references perfiles on delete cascade,
  periodo text not null,        -- 'AAAA-MM'
  snapshot jsonb not null,
  unique (perfil_id, periodo)
);

alter table perfiles enable row level security;
alter table cierres  enable row level security;
create policy p_own on perfiles for all using (auth.uid() = user_id);
create policy c_own on cierres  for all using (auth.uid() = user_id);
