-- Prioriza, na listagem do catálogo, os produtos que têm foto.
--
-- Coluna gerada (STORED): true quando o array `imagens` não está vazio.
-- Permite ordenar por `tem_foto DESC` (com foto primeiro) preservando a
-- variedade por `id` DENTRO de cada grupo — ver lib/data.ts:listProdutos.
-- `imagens` é jsonb NOT NULL default '[]', então não há NULL a tratar.

alter table produtos
  add column if not exists tem_foto boolean
  generated always as (imagens <> '[]'::jsonb) stored;

create index if not exists produtos_tem_foto_idx on produtos (tem_foto);
