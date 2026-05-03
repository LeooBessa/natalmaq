-- ============================================================================
-- Importação de fotos via PDF de fornecedor (Bosch, Makita, ...)
-- ============================================================================

create type import_foto_status as enum ('processando', 'aguardando_review', 'aplicado', 'cancelado');

create table imports_fotos (
  id            uuid primary key default gen_random_uuid(),
  marca_id      uuid references marcas(id) on delete set null,
  arquivo_pdf   text not null,           -- nome original do PDF
  status        import_foto_status not null default 'processando',
  total_paginas int,
  total_produtos int,
  total_imagens int,
  dados         jsonb,                   -- {produtos: [...], imagens: {hash: {url, w, h, tipo, ...}}}
  criado_em     timestamptz not null default now(),
  processado_em timestamptz,
  aplicado_em   timestamptz,
  criado_por    uuid references auth.users(id) on delete set null
);

create index idx_imports_fotos_status on imports_fotos(status);
create index idx_imports_fotos_criado_em on imports_fotos(criado_em desc);

alter table imports_fotos enable row level security;

create policy "Admin full access imports_fotos"
  on imports_fotos for all
  using (public.is_admin())
  with check (public.is_admin());

-- Bucket de fotos importadas (público — fica disponível enquanto a revisão dura)
insert into storage.buckets (id, name, public)
  values ('fotos-import', 'fotos-import', true)
  on conflict (id) do update set public = true;

create policy "Admin upload fotos-import"
  on storage.objects for insert
  with check (bucket_id = 'fotos-import' and public.is_admin());

create policy "Public read fotos-import"
  on storage.objects for select
  using (bucket_id = 'fotos-import');

create policy "Admin delete fotos-import"
  on storage.objects for delete
  using (bucket_id = 'fotos-import' and public.is_admin());

comment on table imports_fotos is
  'Cada upload de PDF de fornecedor gera 1 registro. dados.produtos[] = produtos detectados, dados.imagens[hash] = metadata + URL da foto extraída.';
