-- ============================================================================
-- Hardening: search_path imutavel nas funcoes do schema public
-- ============================================================================
-- Sem SET search_path, um usuario com CREATE no public poderia plantar uma
-- funcao homonima em outro schema e sequestrar chamadas (search_path hijack).
-- Cenario improvavel aqui (so service_role/admin criam objetos no DB),
-- mas o fix e trivial e mantem o linter de seguranca limpo.
-- ============================================================================

create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = pg_catalog, public
as $$ select public.unaccent('public.unaccent', $1) $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
