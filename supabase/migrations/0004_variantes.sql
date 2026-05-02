-- ============================================================================
-- Variantes (mesmo produto, tamanhos/características diferentes)
-- ============================================================================

alter table produtos
  add column produto_pai_id uuid references produtos(id) on delete set null,
  add column variante_label text;

create index idx_produtos_pai on produtos(produto_pai_id) where produto_pai_id is not null;

-- View opcional pra catálogo: só "pais" (não-variantes).
-- Variantes (com produto_pai_id) ficam acessíveis através da página do pai.
-- Não criamos a view aqui; lib/data.ts filtra por produto_pai_id is null.

comment on column produtos.produto_pai_id is
  'Quando preenchido, esse produto é variante de outro. O catálogo público lista apenas linhas com produto_pai_id is null.';
comment on column produtos.variante_label is
  'Rótulo curto da variante (ex: "TAMANHO G", "MSA-025-30", "12DB"). Mostrado no seletor de variantes.';
