-- ============================================================================
-- Natalmaq — Fase 3: tabela de logs de importação + buckets adicionais
-- ============================================================================

create type import_status as enum ('pendente', 'processando', 'concluido', 'erro');

create table imports (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('csv','xlsx','pdf')),
  arquivo_path  text not null,
  arquivo_url   text,
  status        import_status not null default 'pendente',
  linhas_total  int default 0,
  linhas_ok     int default 0,
  linhas_erro   int default 0,
  criar_novos   boolean not null default false,
  detalhes      jsonb default '[]'::jsonb,
  iniciado_em   timestamptz,
  concluido_em  timestamptz,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references auth.users(id)
);

alter table imports enable row level security;

create policy "admin all imports" on imports
  for all using (public.is_admin()) with check (public.is_admin());

-- Bucket privado para os arquivos de import (CSV/XLSX/PDF)
insert into storage.buckets (id, name, public)
  values ('imports', 'imports', false)
  on conflict (id) do nothing;

create policy "admin imports read"
  on storage.objects for select
  using (bucket_id = 'imports' and public.is_admin());

create policy "admin imports write"
  on storage.objects for insert
  with check (bucket_id = 'imports' and public.is_admin());

-- Bucket público para banners + logos de marcas
insert into storage.buckets (id, name, public)
  values ('marketing', 'marketing', true)
  on conflict (id) do nothing;

create policy "marketing read"
  on storage.objects for select
  using (bucket_id = 'marketing');

create policy "marketing admin write"
  on storage.objects for insert
  with check (bucket_id = 'marketing' and public.is_admin());

create policy "marketing admin update"
  on storage.objects for update
  using (bucket_id = 'marketing' and public.is_admin());

create policy "marketing admin delete"
  on storage.objects for delete
  using (bucket_id = 'marketing' and public.is_admin());
