-- ----------------------------------------------------------------------------
-- Natalmaq — Fase 10: enriquecimento de produtos (fotos/descrições via scraping)
--
-- Fila de revisão: o script de busca grava 1 candidato por produto (melhor
-- match no Mercado Livre). O admin revisa e aprova/rejeita pela tela
-- /admin/enriquecimento. Aprovar copia a foto/título para o produto.
-- ----------------------------------------------------------------------------

create table produto_enriquecimento (
  id            uuid primary key default gen_random_uuid(),
  produto_id    uuid not null references produtos(id) on delete cascade,
  fonte         text not null default 'mercadolivre',
  ml_item_id    text,
  titulo        text,
  imagem_url    text not null,
  url_origem    text,
  preco_origem  numeric(12,2),
  score         numeric(6,2) not null default 0,
  status        text not null default 'pendente',   -- pendente | aprovado | rejeitado
  criado_em     timestamptz not null default now(),
  revisado_em   timestamptz
);

-- 1 candidato por produto (o script faz upsert por produto_id).
create unique index idx_enriq_produto on produto_enriquecimento (produto_id);
create index idx_enriq_status on produto_enriquecimento (status, score desc);

alter table produto_enriquecimento enable row level security;

create policy "admin all enriquecimento" on produto_enriquecimento
  for all using (public.is_admin()) with check (public.is_admin());
