-- ============================================================================
-- Natalmaq — SEO/Conteúdo (Fase 3): bucket de storage 'conteudo'
-- ============================================================================
-- Bucket público para imagens de capa/OG dos artigos, clusters e landing pages.
-- Leitura pública; insert/update/delete só para admin (public.is_admin()).
-- Molde: storage policies da migration 0002_admin.sql (bucket 'produtos').
--
-- ----------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
--   drop policy if exists "conteudo imagens admin delete" on storage.objects;
--   drop policy if exists "conteudo imagens admin update" on storage.objects;
--   drop policy if exists "conteudo imagens admin write"  on storage.objects;
--   drop policy if exists "conteudo imagens read"         on storage.objects;
--   delete from storage.buckets where id = 'conteudo';
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('conteudo', 'conteudo', true)
  on conflict (id) do nothing;

-- Leitura pública das imagens
create policy "conteudo imagens read"
  on storage.objects for select
  using (bucket_id = 'conteudo');

-- Apenas admin pode escrever
create policy "conteudo imagens admin write"
  on storage.objects for insert
  with check (bucket_id = 'conteudo' and public.is_admin());

create policy "conteudo imagens admin update"
  on storage.objects for update
  using (bucket_id = 'conteudo' and public.is_admin());

create policy "conteudo imagens admin delete"
  on storage.objects for delete
  using (bucket_id = 'conteudo' and public.is_admin());
