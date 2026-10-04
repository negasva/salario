-- Reparto mensual: una fila por cuenta, con todo el perfil dentro de `data`.
-- Se puede correr las veces que haga falta, también sobre una base que ya
-- tiene la tabla de una versión anterior: no borra datos.

create table if not exists perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  nombre text not null,
  data jsonb not null,          -- { v, name, saldoInicial, cats, movs, recurrentes, ... }
  updated_at timestamptz default now()
);

-- Bases anteriores: al borrar una cuenta, sus datos se van con ella.
alter table perfiles drop constraint if exists perfiles_user_id_fkey;
alter table perfiles add constraint perfiles_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Una fila por cuenta. Si esta línea falla, hay cuentas con filas duplicadas
-- (dos dispositivos que entraron a la vez antes de que existiera el índice).
-- Míralas con
--   select user_id, count(*), max(updated_at) from perfiles group by user_id having count(*) > 1;
-- compara su contenido y borra a mano la que sobre: no se borra sola porque
-- podría tener datos que la otra no tiene.
create unique index if not exists perfiles_user_unico on perfiles (user_id);
drop index if exists perfiles_user_id_idx; -- lo cubre el índice único

-- Cualquiera puede crear una cuenta: un tope por perfil evita llenar la base.
alter table perfiles drop constraint if exists perfiles_tamano;
alter table perfiles add constraint perfiles_tamano check (octet_length(data::text) < 5000000);

-- Cada cuenta ve y escribe solo su fila, y no puede pasarle la suya a otra
-- (`with check`). `(select auth.uid())` se evalúa una vez por consulta, no por fila.
alter table perfiles enable row level security;
drop policy if exists p_own on perfiles;
create policy p_own on perfiles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sin sesión no hay acceso, y con sesión solo lo que la app usa: Supabase da
-- por defecto todos los privilegios (también TRUNCATE, que RLS no filtra).
revoke all on perfiles from anon;
revoke all on perfiles from authenticated;
grant select, insert, update, delete on perfiles to authenticated;

-- La tabla `cierres` de versiones anteriores ya no se usa:
--   drop table if exists cierres;
-- El arrastre de saldo se calcula desde el libro de movimientos, así que no
-- hace falta cerrar meses ni guardar snapshots.
