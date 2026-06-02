-- ============================================================================
-- Tipo de entrega: 'entrega' (default) ou 'retirada' (cliente busca na loja)
-- ============================================================================
-- Coluna text com CHECK constraint. Default 'entrega' pra preservar fluxo
-- atual em pedidos historicos. Quando 'retirada', a aplicacao zera
-- frete_valor e ignora endereco (que pode ser null).
--
-- Rollback:
--   ALTER TABLE public.pedidos DROP COLUMN IF EXISTS tipo_entrega;
-- ============================================================================

alter table public.pedidos
  add column if not exists tipo_entrega text not null default 'entrega'
    check (tipo_entrega in ('entrega', 'retirada'));
