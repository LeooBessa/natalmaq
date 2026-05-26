-- ============================================================================
-- Status "confirmado" (parte 1 de 2)
-- ============================================================================
-- Adiciona o valor 'confirmado' ao enum pedido_status.
-- Fluxo: pendente -> aprovado (vendedor) -> confirmado (cliente)
--        -> enviado | recusado.
--
-- IMPORTANTE: o Postgres exige que ALTER TYPE ... ADD VALUE seja COMMITTED
-- antes de o novo valor ser usado em qualquer query (UPDATE/SELECT/etc).
-- Por isso esta migration faz APENAS o ALTER TYPE. A parte de colunas,
-- trigger e backfill esta em 0015_timestamps_pedido.sql.
--
-- Rollback (complexo, exige recriar o tipo):
--   https://www.postgresql.org/docs/current/datatype-enum.html
-- ============================================================================

alter type public.pedido_status add value if not exists 'confirmado' before 'enviado';
