-- ============================================================================
-- 0033 — Ordenação do catálogo/busca: em estoque → com foto → alfabética
--
-- O PostgREST só ordena por COLUNA (não por expressão como `estoque > 0`).
-- Então criamos a coluna gerada `em_estoque` (espelha a `tem_foto` do 0028) e
-- indexamos na ordem exata usada pela listagem, para o sort sair barato mesmo
-- com ~12 mil produtos.
-- ============================================================================

alter table produtos
  add column if not exists em_estoque boolean
  generated always as (estoque > 0) stored;

create index if not exists idx_produtos_ordem_catalogo
  on produtos (em_estoque desc, tem_foto desc, nome);
