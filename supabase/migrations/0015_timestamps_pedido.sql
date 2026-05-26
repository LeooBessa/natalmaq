-- ============================================================================
-- Timestamps por etapa do pedido + trigger (parte 2 de 2)
-- ============================================================================
-- Depende de 0014 ja aplicado (precisa do valor 'confirmado' no enum).
-- pendente_em = criado_em (ja existe na tabela).
--
-- O trigger carimba a coluna correspondente na transicao de status, de forma
-- idempotente (so seta se ainda for null).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS pedidos_carimbar_timestamps ON public.pedidos;
--   DROP FUNCTION IF EXISTS public.carimbar_timestamps_pedido();
--   ALTER TABLE public.pedidos
--     DROP COLUMN IF EXISTS aprovado_em,
--     DROP COLUMN IF EXISTS confirmado_em,
--     DROP COLUMN IF EXISTS enviado_em,
--     DROP COLUMN IF EXISTS recusado_em;
-- ============================================================================

alter table public.pedidos
  add column if not exists aprovado_em   timestamptz,
  add column if not exists confirmado_em timestamptz,
  add column if not exists enviado_em    timestamptz,
  add column if not exists recusado_em   timestamptz;

create or replace function public.carimbar_timestamps_pedido()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'aprovado' and new.aprovado_em is null then
      new.aprovado_em := now();
    elsif new.status = 'confirmado' and new.confirmado_em is null then
      new.confirmado_em := now();
    elsif new.status = 'enviado' and new.enviado_em is null then
      new.enviado_em := now();
    elsif new.status = 'recusado' and new.recusado_em is null then
      new.recusado_em := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_carimbar_timestamps on public.pedidos;

create trigger pedidos_carimbar_timestamps
  before update on public.pedidos
  for each row execute function public.carimbar_timestamps_pedido();

-- Backfill: pedidos historicos sem timestamps recebem o atualizado_em como
-- aproximacao da data em que entraram no status atual.
update public.pedidos
set aprovado_em = atualizado_em
where status in ('aprovado', 'confirmado', 'enviado') and aprovado_em is null;

update public.pedidos
set enviado_em = atualizado_em
where status = 'enviado' and enviado_em is null;

update public.pedidos
set recusado_em = atualizado_em
where status = 'recusado' and recusado_em is null;
