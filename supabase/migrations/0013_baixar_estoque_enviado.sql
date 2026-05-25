-- ============================================================================
-- Baixa de estoque ao marcar pedido como 'enviado'
-- ============================================================================
-- Regras:
--   1) Dispara apenas na transicao OLD.status != 'enviado' AND NEW.status = 'enviado'.
--      Ou seja, so baixa estoque na PRIMEIRA vez que vira enviado.
--   2) Idempotente via coluna pedidos.estoque_baixado_em: se ja foi baixado,
--      nao baixa de novo (ex: admin volta status e marca enviado novamente).
--   3) Itens com pedido_itens.disponivel = false sao IGNORADOS (admin marcou
--      como sem estoque - nao saiu da loja).
--   4) NAO reverte estoque se status sair de 'enviado'. Ajuste de inventario
--      vira manualmente pelo admin (evita dupla devolucao por engano).
--   5) GREATEST(0, ...) garante que estoque nunca fica negativo.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS pedidos_baixar_estoque ON public.pedidos;
--   DROP FUNCTION IF EXISTS public.descontar_estoque_pedido();
--   ALTER TABLE public.pedidos DROP COLUMN IF EXISTS estoque_baixado_em;
-- ============================================================================

alter table public.pedidos
  add column if not exists estoque_baixado_em timestamptz;

create or replace function public.descontar_estoque_pedido()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'enviado'
     and (old.status is distinct from 'enviado')
     and new.estoque_baixado_em is null
  then
    update public.produtos p
    set estoque = greatest(0, p.estoque - pi.quantidade)
    from public.pedido_itens pi
    where pi.pedido_id = new.id
      and pi.disponivel = true
      and p.id = pi.produto_id;

    new.estoque_baixado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_baixar_estoque on public.pedidos;

create trigger pedidos_baixar_estoque
  before update on public.pedidos
  for each row execute function public.descontar_estoque_pedido();
