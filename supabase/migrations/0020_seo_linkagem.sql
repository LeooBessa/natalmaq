-- ============================================================================
-- Natalmaq — Fase 2 do sistema de SEO: Motor de Linkagem Interna
--   - artigos.*           (colunas de materializacao do resultado do motor)
--   - artigo_links        (grafo de arestas artigo -> entidade; auditoria/sitemap)
--   - seo_sinonimos       (dicionario curado pelo admin: termo -> entidade)
--   - produtos_relevantes_para_texto(text, int)  (RPC tsvector — reforco)
--
-- Custo zero em runtime: matching pre-computado no save (admin), render so le
-- o JSONB materializado. O RPC tsvector e REFORCO opcional (full-text contra
-- produtos.busca_tsv), seguindo o padrao de score deterministico de
-- 0012_recomendacoes.sql (security invoker, grant execute to anon).
--
-- Convencoes herdadas (0001/0002/0012/0016/0019):
--   pt-BR; RLS (leitura publica conforme regra, escrita so admin via
--   public.is_admin()); grants explicitos (0016 ja cobre futuras tabelas via
--   alter default privileges, reforcados aqui por clareza/idempotencia);
--   funcoes reusam public.immutable_unaccent(text) de 0001.
--
-- Tudo idempotente (add column if not exists / create table if not exists /
-- create index if not exists / create or replace function). Seguro reaplicar.
--
-- Depende de 0019_seo_conteudo.sql (tabela artigos). Se 0019 nao estiver
-- aplicada, esta migration falha — ambas formam a base do conteudo no Supabase.
-- O front (lib/conteudo.ts) faz try/catch em toda leitura: build/site nunca
-- quebram mesmo sem estas tabelas aplicadas.
--
-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop function if exists public.produtos_relevantes_para_texto(text, int);
--   drop table    if exists seo_sinonimos cascade;
--   drop table    if exists artigo_links  cascade;
--   alter table artigos
--     drop column if exists links_geradoem,
--     drop column if exists links_locked,
--     drop column if exists relacionados,
--     drop column if exists links_inline;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Resultado materializado do motor — colunas na propria tabela artigos.
--    Fase 3 (server action de save) popula; Fase 2 tambem pode popular.
--      links_inline   : InlineLink[]  (links in-content)
--      relacionados   : { produtos, categorias, marcas, leiaTambem, pillar }
--      links_locked   : admin trancou edicao manual -> motor nao sobrescreve
--      links_geradoem : timestamp da ultima geracao
-- ----------------------------------------------------------------------------
alter table artigos
  add column if not exists links_inline   jsonb       not null default '[]'::jsonb,
  add column if not exists relacionados   jsonb       not null default '{}'::jsonb,
  add column if not exists links_locked   boolean     not null default false,
  add column if not exists links_geradoem timestamptz;

-- ----------------------------------------------------------------------------
-- 2) artigo_links — grafo de arestas (1 linha por aresta artigo -> entidade).
--    Fonte de verdade analitica: paginas orfas, inlinks por produto, malha
--    bidirecional pillar<->satelite, sitemap. Gravado na mesma transacao do save.
--    target_id e null p/ destinos sem uuid (ex: categoria via querystring).
-- ----------------------------------------------------------------------------
create table if not exists artigo_links (
  id           uuid primary key default gen_random_uuid(),
  artigo_id    uuid not null references artigos(id) on delete cascade,
  target_type  text not null check (target_type in ('produto','categoria','marca','artigo','cluster')),
  target_id    uuid,                 -- null p/ destinos nao-uuid (categoria por slug)
  target_slug  text not null,
  target_href  text not null,
  contexto     text not null check (contexto in ('inline','produtos','categorias','marcas','leia_tambem','pillar')),
  anchor       text,                 -- ancora usada (so p/ contexto 'inline')
  posicao      int  not null default 0,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_artigo_links_artigo on artigo_links(artigo_id);
create index if not exists idx_artigo_links_target on artigo_links(target_type, target_id);

-- ----------------------------------------------------------------------------
-- 3) seo_sinonimos — dicionario curado pelo admin (termo -> entidade canonica).
--    Reforca/ajusta o dicionario automatico do motor.
--    ex: "parafusadeira sem fio" -> categoria; "alicate isolado nr10" -> produto.
--    Unique por lower(termo) (case-insensitive).
-- ----------------------------------------------------------------------------
create table if not exists seo_sinonimos (
  id           uuid primary key default gen_random_uuid(),
  termo        text not null,
  target_type  text not null check (target_type in ('produto','categoria','marca','artigo','cluster')),
  target_id    uuid,
  target_slug  text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create unique index if not exists idx_seo_sinonimos_termo on seo_sinonimos(lower(termo));

-- ============================================================================
-- 4) RLS — Row Level Security
-- ============================================================================
alter table artigo_links  enable row level security;
alter table seo_sinonimos enable row level security;

-- Leitura publica -------------------------------------------------------------
-- Grafo de links: publico (render le via colunas em artigos; grafo serve a
-- sitemap/RPC/auditoria, sem dados sensiveis).
drop policy if exists "artigo_links read" on artigo_links;
create policy "artigo_links read" on artigo_links
  for select using (true);

-- Sinonimos: so os ativos (o motor so deve enxergar entradas vigentes).
drop policy if exists "seo_sinonimos read" on seo_sinonimos;
create policy "seo_sinonimos read" on seo_sinonimos
  for select using (ativo);

-- Escrita: so admin (igual 0002/0019) ----------------------------------------
drop policy if exists "admin all artigo_links" on artigo_links;
create policy "admin all artigo_links" on artigo_links
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all seo_sinonimos" on seo_sinonimos;
create policy "admin all seo_sinonimos" on seo_sinonimos
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Grants explicitos (reforco; 0016 ja cobre futuras tabelas via default privs)
-- ============================================================================
grant all on artigo_links, seo_sinonimos
  to anon, authenticated, service_role;

-- ============================================================================
-- 5) RPC public.produtos_relevantes_para_texto(texto, limite)
--    Reforco full-text: dado o texto agregado de um artigo (corpo + keywords),
--    retorna os produtos mais relevantes por busca_tsv com score por ts_rank.
--    Padrao identico a recomendar_para_carrinho (0012): sql stable,
--    security invoker (respeita RLS de produtos), grant execute to anon.
--    Filtros: ativo, produto_pai_id is null, estoque > 0 (so vendaveis).
--    limite clamp 1..12.
-- ----------------------------------------------------------------------------
create or replace function public.produtos_relevantes_para_texto(
  texto  text,
  limite int default 6
)
returns table (
  id uuid,
  slug text,
  nome text,
  preco numeric,
  preco_promocional numeric,
  imagens jsonb,
  marca jsonb,
  score real
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('portuguese', public.immutable_unaccent(coalesce(texto, ''))) as tsq
  )
  select
    p.id,
    p.slug,
    p.nome,
    p.preco,
    p.preco_promocional,
    p.imagens,
    case when m.id is null then null
         else jsonb_build_object('id', m.id, 'nome', m.nome, 'slug', m.slug)
    end as marca,
    ts_rank(p.busca_tsv, q.tsq) as score
  from produtos p
  cross join q
  left join marcas m on m.id = p.marca_id
  where p.ativo
    and p.produto_pai_id is null
    and p.estoque > 0
    and p.busca_tsv @@ q.tsq
  order by
    score desc,
    (p.preco_promocional is not null) desc,
    p.nome asc
  limit greatest(1, least(coalesce(limite, 6), 12));
$$;

grant execute on function public.produtos_relevantes_para_texto(text, int)
  to anon, authenticated, service_role;
