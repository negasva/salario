import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/* El esquema de Supabase se probó contra un Postgres real (cada cuenta ve solo
   lo suyo, no puede escribir a nombre de otra, una fila por cuenta, sin TRUNCATE
   ni acceso sin sesión). Aquí queda guardado lo que no debe perderse al editarlo. */
const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');

describe('supabase/schema.sql', () => {
  it('la política cubre lectura y escritura con with check, solo para quien tiene sesión', () => {
    expect(sql).toMatch(/create policy p_own on perfiles for all to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)\s+with check \(\(select auth\.uid\(\)\) = user_id\)/);
  });

  it('una fila por cuenta y borrar la cuenta borra sus datos', () => {
    expect(sql).toMatch(/create unique index if not exists perfiles_user_unico on perfiles \(user_id\)/);
    expect(sql).toMatch(/on delete cascade/);
  });

  it('quita los privilegios por defecto y deja solo los que la app usa', () => {
    expect(sql).toMatch(/revoke all on perfiles from anon/);
    expect(sql).toMatch(/revoke all on perfiles from authenticated/);
    expect(sql).toMatch(/grant select, insert, update, delete on perfiles to authenticated/);
    expect(sql).not.toMatch(/grant[^;]*truncate/i);
  });

  it('se puede correr de nuevo y no borra datos', () => {
    expect(sql).not.toMatch(/\bdelete from\b|\btruncate\b|drop table/i);
    expect(sql).toMatch(/create table if not exists perfiles/);
  });
});
