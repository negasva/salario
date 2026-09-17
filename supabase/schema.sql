create table perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nombre text not null,
  data jsonb not null,          -- { v, name, saldoInicial, cats, movs }
  updated_at timestamptz default now()
);

alter table perfiles enable row level security;
create policy p_own on perfiles for all using (auth.uid() = user_id);

-- Si vienes de una versión anterior, la tabla `cierres` ya no se usa:
--   drop table if exists cierres;
-- El arrastre de saldo se calcula desde el libro de movimientos, así que no
-- hace falta cerrar meses ni guardar snapshots.
