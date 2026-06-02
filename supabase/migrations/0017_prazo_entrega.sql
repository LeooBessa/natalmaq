-- ============================================================================
-- Prazo de entrega informado pelo admin
-- ============================================================================
-- 2 colunas em pedidos:
--   prazo_entrega_data (date)  - data prevista de entrega
--   prazo_entrega_obs  (text)  - observacao curta opcional ("sai na quinta")
--
-- Ambas null por padrao. Admin preenche pela tela de edicao do pedido,
-- cliente ve em /minha-conta/pedido/[id] e na lista /minha-conta.
--
-- Rollback:
--   ALTER TABLE public.pedidos
--     DROP COLUMN IF EXISTS prazo_entrega_data,
--     DROP COLUMN IF EXISTS prazo_entrega_obs;
-- ============================================================================

alter table public.pedidos
  add column if not exists prazo_entrega_data date,
  add column if not exists prazo_entrega_obs  text;
