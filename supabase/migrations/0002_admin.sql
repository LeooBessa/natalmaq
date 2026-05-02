-- ============================================================================
-- Natalmaq — Fase 2: admin / autenticação
-- ============================================================================
-- Pré-requisito: cada admin precisa primeiro ser criado em Authentication →
-- Users (no painel Supabase) com e-mail+senha. Em seguida insere-se um row
-- nesta tabela apontando para auth.users.id.

create table if not exists admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  role        text not null default 'admin' check (role in ('admin','operador')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

alter table admins enable row level security;

-- Admin lê seus próprios dados
create policy "admin lê próprio registro"
  on admins for select
  using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Helper: usuário autenticado é admin ativo?
-- ----------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.admins
    where id = auth.uid() and ativo = true
  );
$$;

-- ----------------------------------------------------------------------------
-- Políticas de admin (concedem CRUD em todas as tabelas operacionais)
-- ----------------------------------------------------------------------------

-- Marcas
create policy "admin all marcas" on marcas
  for all using (public.is_admin()) with check (public.is_admin());

-- Categorias
create policy "admin all categorias" on categorias
  for all using (public.is_admin()) with check (public.is_admin());

-- Produtos
create policy "admin all produtos" on produtos
  for all using (public.is_admin()) with check (public.is_admin());

-- Banners
create policy "admin all banners" on banners
  for all using (public.is_admin()) with check (public.is_admin());

-- Avaliações (admin pode aprovar / moderar)
create policy "admin all avaliacoes" on avaliacoes
  for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos (admin lê / atualiza / não deleta — só status)
create policy "admin select pedidos" on pedidos
  for select using (public.is_admin());

create policy "admin update pedidos" on pedidos
  for update using (public.is_admin()) with check (public.is_admin());

-- Itens de pedido (somente leitura para admin — itens são imutáveis)
create policy "admin select pedido_itens" on pedido_itens
  for select using (public.is_admin());

-- Regras de frete
create policy "admin all fretes_regra" on fretes_regra
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Storage bucket de produtos (criar manualmente OU via SQL)
-- ----------------------------------------------------------------------------
-- A criação do bucket é feita via API/painel. Mas as policies vão aqui:
--   bucket: 'produtos' (público para read, restrito para write)

insert into storage.buckets (id, name, public)
  values ('produtos', 'produtos', true)
  on conflict (id) do nothing;

-- Leitura pública das imagens
create policy "produtos imagens read"
  on storage.objects for select
  using (bucket_id = 'produtos');

-- Apenas admin pode escrever
create policy "produtos imagens admin write"
  on storage.objects for insert
  with check (bucket_id = 'produtos' and public.is_admin());

create policy "produtos imagens admin update"
  on storage.objects for update
  using (bucket_id = 'produtos' and public.is_admin());

create policy "produtos imagens admin delete"
  on storage.objects for delete
  using (bucket_id = 'produtos' and public.is_admin());
