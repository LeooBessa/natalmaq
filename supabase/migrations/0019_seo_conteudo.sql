-- ============================================================================
-- Natalmaq — Fase 1 do sistema de SEO / Conteúdo
--   - autores         (E-E-A-T: Person — nome, cargo, bio, foto, sameAs)
--   - clusters        (arquitetura pillar + clusters → /guias/[slug])
--   - palavras_chave  (pesquisa de SEO: oportunidade + volume + sinônimos)
--   - artigos         (corpo em blocos JSONB, schema rico, SEO por entidade)
--   - landing_pages   (B2B / local → /solucoes/[slug])
--   - entidade_keyword(linkagem interna: keyword -> entidade canônica, soft FK)
--
-- Convenções herdadas (copiadas 1:1 de 0001/0002/0011/0016):
--   pt-BR, slug text not null unique, created_at/updated_at + trigger
--   public.set_updated_at(), tsvector com immutable_unaccent + 'portuguese' + GIN,
--   RLS (leitura pública por status publicado, escrita só admin via
--   public.is_admin()), grants explícitos (0016 já cobre futuras tabelas via
--   alter default privileges, reforçados aqui por clareza/idempotência).
--
-- NÃO inclui (Fase 2): artigo_links, seo_sinonimos, artigo_relacionado, colunas
--   de linkagem materializada (links_inline/relacionados) e RPCs de matching.
--
-- ----------------------------------------------------------------------------
-- ROLLBACK (ordem inversa por FK):
--   drop table if exists entidade_keyword cascade;
--   drop table if exists landing_pages    cascade;
--   drop table if exists artigos          cascade;
--   drop table if exists palavras_chave   cascade;
--   drop table if exists clusters         cascade;
--   drop table if exists autores          cascade;
--   drop type  if exists alvo_seo;
--   drop type  if exists oportunidade_seo;
--   drop type  if exists status_conteudo;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos enum (idempotentes — não falham se a migration rodar parcialmente)
-- ----------------------------------------------------------------------------
do $$ begin
  create type status_conteudo as enum ('rascunho', 'publicado', 'arquivado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type oportunidade_seo as enum ('alto', 'medio', 'baixo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alvo_seo as enum (
    'produto', 'categoria', 'marca', 'artigo', 'cluster', 'landing'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- autores — E-E-A-T: Person (nome, cargo, bio, foto, sameAs) para o JSON-LD
-- ----------------------------------------------------------------------------
create table if not exists autores (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nome        text not null,
  cargo       text,                                  -- "Especialista técnico"
  bio         text,                                  -- 1-3 frases, credenciais
  foto_url    text,
  sameas      jsonb not null default '[]'::jsonb,    -- ["https://linkedin.com/...", ...]
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- clusters — tópico-pilar (cada cluster tem sua própria página /guias/[slug])
-- ----------------------------------------------------------------------------
create table if not exists clusters (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  titulo              text not null,
  subtitulo           text,
  intro               text,                          -- prosa de abertura do pilar
  -- artigo "pilar" deste cluster (1:1, opcional). FK adicionada depois de criar
  -- artigos para evitar dependência circular.
  artigo_pilar_id     uuid,
  ordem               int not null default 0,
  -- SEO
  meta_title          text,
  meta_description    text,
  canonical           text,
  og_image            text,
  noindex             boolean not null default false,
  primary_keyword_id  uuid,                          -- FK -> palavras_chave (abaixo)
  status              status_conteudo not null default 'rascunho',
  published_at        timestamptz,
  autor_id            uuid references admins(id) on delete set null,
  autor_nome          text not null default 'Equipe Natalmaq',
  faq                 jsonb not null default '[]'::jsonb,  -- [{pergunta, resposta}]
  busca_tsv tsvector generated always as (
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(titulo,''))), 'A') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(subtitulo,''))), 'B') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(intro,''))), 'C')
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_clusters_status on clusters(status, ordem) where status = 'publicado';
create index if not exists idx_clusters_busca  on clusters using gin (busca_tsv);

-- ----------------------------------------------------------------------------
-- palavras_chave — pesquisa de SEO (termos / oportunidade / volume / sinônimos)
-- ----------------------------------------------------------------------------
create table if not exists palavras_chave (
  id                uuid primary key default gen_random_uuid(),
  termo             text not null,                   -- "alicate isolado nr10"
  slug              text not null unique,            -- "alicate-isolado-nr10"
  oportunidade      oportunidade_seo not null default 'medio',
  volume_estimado   int,                             -- visitas/mês estimadas (nullable)
  sinonimos         text[] not null default '{}',    -- variações p/ matching de links
  cluster_id        uuid references clusters(id) on delete set null,
  eh_featured       boolean not null default false,  -- termo "featured snippet" do cluster
  observacoes       text,
  termo_tsv tsvector generated always as (
    to_tsvector('portuguese', immutable_unaccent(coalesce(termo,'')))
  ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_kw_cluster      on palavras_chave(cluster_id);
create index if not exists idx_kw_oportunidade on palavras_chave(oportunidade);
create index if not exists idx_kw_termo_tsv    on palavras_chave using gin (termo_tsv);
create index if not exists idx_kw_termo_trgm   on palavras_chave using gin (termo gin_trgm_ops);

-- clusters.primary_keyword_id -> palavras_chave (FK após ambas existirem)
alter table clusters
  add constraint clusters_primary_keyword_fk
  foreign key (primary_keyword_id) references palavras_chave(id) on delete set null;

-- ----------------------------------------------------------------------------
-- artigos — conteúdo editorial (corpo em blocos JSONB = ArticleBlock[])
-- ----------------------------------------------------------------------------
create table if not exists artigos (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  titulo              text not null,
  categoria_label     text,                          -- badge livre ("Segurança")
  excerpt             text not null,
  imagem              text,                          -- hero / OG fallback
  -- corpo em blocos: ArticleBlock[] = heading|paragraph|list (lib/articles.ts).
  -- Validação de forma é leve aqui (CHECK array); validação real no server (TS).
  corpo               jsonb not null default '[]'::jsonb,
  -- pillar / cluster
  cluster_id          uuid references clusters(id) on delete set null,
  eh_pilar            boolean not null default false,
  -- SEO
  meta_title          text,
  meta_description    text,
  canonical           text,
  og_image            text,
  noindex             boolean not null default false,
  keywords            text[] not null default '{}',  -- meta keywords (legado/compat)
  primary_keyword_id  uuid references palavras_chave(id) on delete set null,
  status              status_conteudo not null default 'rascunho',
  published_at        timestamptz,
  autor_id            uuid references admins(id) on delete set null,
  autor_nome          text not null default 'Equipe Natalmaq',
  reading_time        int,                           -- minutos (calculado em código)
  -- schema rico (montado em JSON-LD pelo front)
  faq                 jsonb not null default '[]'::jsonb,  -- [{pergunta, resposta}]
  howto               jsonb,                               -- {nome, passos:[{nome, texto, imagem}]}
  ordem               int not null default 0,
  busca_tsv tsvector generated always as (
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(titulo,''))), 'A') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(excerpt,''))), 'B') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(corpo::text,''))), 'C')
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint artigos_corpo_array check (jsonb_typeof(corpo) = 'array'),
  constraint artigos_faq_array   check (jsonb_typeof(faq)   = 'array')
);

create index if not exists idx_artigos_status  on artigos(status, published_at desc) where status = 'publicado';
create index if not exists idx_artigos_cluster on artigos(cluster_id);
create index if not exists idx_artigos_pilar   on artigos(eh_pilar) where eh_pilar;
create index if not exists idx_artigos_busca   on artigos using gin (busca_tsv);

-- clusters.artigo_pilar_id -> artigos (FK + unicidade do pilar por cluster)
alter table clusters
  add constraint clusters_artigo_pilar_fk
  foreign key (artigo_pilar_id) references artigos(id) on delete set null;
create unique index if not exists idx_clusters_pilar_unico on clusters(artigo_pilar_id)
  where artigo_pilar_id is not null;

-- ----------------------------------------------------------------------------
-- landing_pages — B2B / local (ex. "comprar ferramentas com cnpj em natal")
-- ----------------------------------------------------------------------------
create table if not exists landing_pages (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  titulo              text not null,
  subtitulo           text,
  -- segmentação local / B2B (alimenta LocalBusiness/areaServed e copy)
  cidade              text default 'Natal',
  uf                  text default 'RN',
  publico             text,                          -- "eletricistas", "construtoras"...
  -- conteúdo flexível em blocos (mesmo ArticleBlock[] reaproveitado)
  corpo               jsonb not null default '[]'::jsonb,
  hero_imagem         text,
  -- vínculos opcionais para montar ItemList/CollectionPage automaticamente
  categoria_id        uuid references categorias(id) on delete set null,
  marca_id            uuid references marcas(id) on delete set null,
  cluster_id          uuid references clusters(id) on delete set null,
  produtos_destaque   uuid[] not null default '{}', -- ids p/ ItemList (curado)
  -- SEO
  meta_title          text,
  meta_description    text,
  canonical           text,
  og_image            text,
  noindex             boolean not null default false,
  primary_keyword_id  uuid references palavras_chave(id) on delete set null,
  status              status_conteudo not null default 'rascunho',
  published_at        timestamptz,
  autor_id            uuid references admins(id) on delete set null,
  faq                 jsonb not null default '[]'::jsonb,
  ordem               int not null default 0,
  busca_tsv tsvector generated always as (
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(titulo,''))), 'A') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(subtitulo,''))), 'B')
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint landing_corpo_array check (jsonb_typeof(corpo) = 'array')
);

create index if not exists idx_landing_status on landing_pages(status, ordem) where status = 'publicado';
create index if not exists idx_landing_busca  on landing_pages using gin (busca_tsv);

-- ----------------------------------------------------------------------------
-- entidade_keyword — destino canônico de cada palavra-chave (linkagem interna)
--   keyword -> (produto | categoria | marca | artigo | cluster | landing)
--   Polimórfico: alvo_id uuid + alvo_tipo enum (soft FK por design — doc 01 §2.3).
-- ----------------------------------------------------------------------------
create table if not exists entidade_keyword (
  id           uuid primary key default gen_random_uuid(),
  keyword_id   uuid not null references palavras_chave(id) on delete cascade,
  alvo_tipo    alvo_seo not null,
  alvo_id      uuid not null,
  principal    boolean not null default true,        -- destino preferencial do termo
  peso         int not null default 1,               -- prioridade de link
  created_at   timestamptz not null default now()
);

create unique index if not exists idx_ent_kw_unico   on entidade_keyword (keyword_id, alvo_tipo, alvo_id);
create index        if not exists idx_ent_kw_keyword on entidade_keyword (keyword_id);
create index        if not exists idx_ent_kw_alvo    on entidade_keyword (alvo_tipo, alvo_id);

-- ----------------------------------------------------------------------------
-- Triggers updated_at (reusa public.set_updated_at() de 0001/0011)
-- ----------------------------------------------------------------------------
create trigger autores_updated_at        before update on autores
  for each row execute function public.set_updated_at();
create trigger clusters_updated_at       before update on clusters
  for each row execute function public.set_updated_at();
create trigger palavras_chave_updated_at before update on palavras_chave
  for each row execute function public.set_updated_at();
create trigger artigos_updated_at        before update on artigos
  for each row execute function public.set_updated_at();
create trigger landing_pages_updated_at  before update on landing_pages
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — Row Level Security
-- ============================================================================
alter table autores          enable row level security;
alter table clusters         enable row level security;
alter table palavras_chave   enable row level security;
alter table artigos          enable row level security;
alter table landing_pages    enable row level security;
alter table entidade_keyword enable row level security;

-- Leitura pública --------------------------------------------------------------
-- Autores: só os ativos (E-E-A-T exibido no front).
create policy "autores read" on autores for select using (ativo);

-- Conteúdo com URL pública: só publicado e dentro da data de publicação
-- (permite agendar com published_at no futuro).
create policy "clusters read" on clusters for select using (
  status = 'publicado' and (published_at is null or published_at <= now())
);
create policy "artigos read" on artigos for select using (
  status = 'publicado' and (published_at is null or published_at <= now())
);
create policy "landing read" on landing_pages for select using (
  status = 'publicado' and (published_at is null or published_at <= now())
);

-- Metadados de SEO leem-se livremente (públicos por natureza e necessários para
-- resolver links no front). Sem dados sensíveis.
create policy "palavras_chave read"   on palavras_chave   for select using (true);
create policy "entidade_keyword read" on entidade_keyword for select using (true);

-- Escrita: só admin (igual 0002) -----------------------------------------------
create policy "admin all autores" on autores
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all clusters" on clusters
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all palavras_chave" on palavras_chave
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all artigos" on artigos
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all landing_pages" on landing_pages
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all entidade_keyword" on entidade_keyword
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Grants explícitos (reforço; 0016 já cobre futuras tabelas via default privs)
-- ============================================================================
grant all on autores, clusters, palavras_chave, artigos, landing_pages,
             entidade_keyword
  to anon, authenticated, service_role;

-- ============================================================================
-- SEED — idempotente (on conflict (slug) do nothing).
--   a) 10 clusters (doc 04 §3)
--   b) palavras-chave de cada cluster (doc 04 §3/§4)
--   c) migração dos 3 artigos hardcoded (lib/articles.ts)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- a) Clusters (pillar pages /guias/[slug]) — doc 04 §3
-- ----------------------------------------------------------------------------
insert into clusters (slug, titulo, meta_title, meta_description, status, published_at, ordem) values
  ('ferramentas-para-eletricista',
   'Guia completo de ferramentas para eletricista profissional',
   'Ferramentas para Eletricista: Guia Completo e Kit Profissional',
   'Guia definitivo de ferramentas para eletricista: kit profissional, alicate isolado NR10 e o que não pode faltar. Monte seu orçamento em Natal/RN.',
   'publicado', now(), 1),
  ('furadeira-de-impacto-e-parafusadeira',
   'Furadeira de impacto e parafusadeira: o guia para escolher certo',
   'Furadeira de Impacto vs Parafusadeira: Guia para Escolher',
   'Entenda a diferença entre furadeira de impacto e parafusadeira, qual comprar e quando usar cada uma. Modelos Bosch, Makita e DeWalt em Natal/RN.',
   'publicado', now(), 2),
  ('fornecedor-industrial-rn',
   'Fornecedor industrial no Rio Grande do Norte: guia de compra',
   'Fornecedor Industrial RN: Ferramentas e Equipamentos em Natal',
   'Como escolher um fornecedor industrial no RN. Distribuidor de ferramentas, máquinas e EPI em Natal com entrega em todo o estado.',
   'publicado', now(), 3),
  ('comprar-ferramentas-cnpj',
   'Comprar ferramentas com CNPJ: guia para empresas',
   'Comprar Ferramentas com CNPJ: Guia de Compra B2B',
   'Tudo sobre comprar ferramentas industriais com CNPJ: nota fiscal, faturamento e compra B2B para empresas em Natal/RN.',
   'publicado', now(), 4),
  ('bosch-makita-dewalt-profissional',
   'Bosch, Makita ou DeWalt: qual a melhor marca de ferramenta profissional',
   'Bosch vs DeWalt vs Makita: Melhor Marca Profissional',
   'Comparativo completo: Bosch, DeWalt e Makita para uso profissional. Veja qual marca de ferramenta elétrica vale mais a pena.',
   'publicado', now(), 5),
  ('manutencao-industrial',
   'Equipamentos para manutenção industrial e predial: guia',
   'Equipamentos para Manutenção Industrial: Guia Completo',
   'Guia de equipamentos e ferramentas para manutenção industrial e predial: abrasivos, ferramentas e EPI. Fornecimento para empresas no RN.',
   'publicado', now(), 6),
  ('serra-circular-marcenaria',
   'Serra circular para marcenaria: guia de escolha e corte de madeira',
   'Serra Circular para Marcenaria: Guia e Melhores Modelos',
   'Como escolher serra circular para marcenaria e corte de madeira. Comparativo DeWalt e Bosch, discos e dicas profissionais.',
   'publicado', now(), 7),
  ('manutencao-ferramentas-eletricas',
   'Manutenção de ferramentas elétricas: guia para durar mais',
   'Manutenção de Ferramentas Elétricas: Guia Completo',
   'Como fazer a manutenção de ferramentas elétricas e dobrar a vida útil. Revisão, limpeza e assistência técnica Bosch em Natal.',
   'publicado', now(), 8),
  ('epi-para-obras',
   'Como escolher EPI para obras: guia de proteção individual',
   'EPI para Obras: Guia Completo de Proteção Individual',
   'Guia completo de EPI para obras e construção civil: o que é obrigatório, como escolher por risco e onde comprar com CA ativo em Natal.',
   'publicado', now(), 9),
  ('normas-nr-seguranca-trabalho',
   'Normas NR de segurança no trabalho: guia prático',
   'Normas NR de Segurança no Trabalho: Guia Prático (NR-6, NR-12)',
   'Guia das principais normas NR de segurança no trabalho: NR-6 (EPI), NR-12 (máquinas) e segurança na construção civil.',
   'publicado', now(), 10)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- b) Palavras-chave por cluster (doc 04 §3 primary_kw + §4 secondary) —
--    slug = kebab-case do termo; cluster_id via subselect por slug.
-- ----------------------------------------------------------------------------
insert into palavras_chave (termo, slug, oportunidade, eh_featured, cluster_id) values
  -- Cluster 1 — Ferramentas para eletricista
  ('ferramentas para eletricista', 'ferramentas-para-eletricista', 'alto', false,
     (select id from clusters where slug = 'ferramentas-para-eletricista')),
  ('kit ferramentas eletricista profissional', 'kit-ferramentas-eletricista-profissional', 'alto', false,
     (select id from clusters where slug = 'ferramentas-para-eletricista')),
  ('alicate isolado nr10', 'alicate-isolado-nr10', 'alto', false,
     (select id from clusters where slug = 'ferramentas-para-eletricista')),

  -- Cluster 2 — Furadeira de impacto vs parafusadeira
  ('furadeira de impacto', 'furadeira-de-impacto', 'alto', false,
     (select id from clusters where slug = 'furadeira-de-impacto-e-parafusadeira')),
  ('diferença furadeira parafusadeira', 'diferenca-furadeira-parafusadeira', 'medio', false,
     (select id from clusters where slug = 'furadeira-de-impacto-e-parafusadeira')),
  ('parafusadeira de impacto', 'parafusadeira-de-impacto', 'medio', false,
     (select id from clusters where slug = 'furadeira-de-impacto-e-parafusadeira')),

  -- Cluster 3 — Fornecedor industrial RN
  ('fornecedor ferramentas rn', 'fornecedor-ferramentas-rn', 'alto', false,
     (select id from clusters where slug = 'fornecedor-industrial-rn')),
  ('distribuidor industrial natal rn', 'distribuidor-industrial-natal-rn', 'medio', false,
     (select id from clusters where slug = 'fornecedor-industrial-rn')),

  -- Cluster 4 — Comprar ferramentas com CNPJ
  ('compra b2b ferramentas industriais', 'compra-b2b-ferramentas-industriais', 'alto', false,
     (select id from clusters where slug = 'comprar-ferramentas-cnpj')),
  ('comprar ferramentas com cnpj', 'comprar-ferramentas-com-cnpj', 'alto', false,
     (select id from clusters where slug = 'comprar-ferramentas-cnpj')),
  ('ferramentas para empresa natal rn', 'ferramentas-para-empresa-natal-rn', 'medio', false,
     (select id from clusters where slug = 'comprar-ferramentas-cnpj')),

  -- Cluster 5 — Bosch x DeWalt x Makita profissional
  ('melhor marca ferramenta elétrica', 'melhor-marca-ferramenta-eletrica', 'alto', false,
     (select id from clusters where slug = 'bosch-makita-dewalt-profissional')),
  ('dewalt ou bosch profissional', 'dewalt-ou-bosch-profissional', 'alto', false,
     (select id from clusters where slug = 'bosch-makita-dewalt-profissional')),
  ('bosch vs dewalt', 'bosch-vs-dewalt', 'medio', false,
     (select id from clusters where slug = 'bosch-makita-dewalt-profissional')),

  -- Cluster 6 — Manutenção industrial
  ('ferramentas manutenção industrial', 'ferramentas-manutencao-industrial', 'medio', false,
     (select id from clusters where slug = 'manutencao-industrial')),
  ('abrasivos industriais natal', 'abrasivos-industriais-natal', 'baixo', false,
     (select id from clusters where slug = 'manutencao-industrial')),
  ('equipamentos manutenção predial', 'equipamentos-manutencao-predial', 'baixo', false,
     (select id from clusters where slug = 'manutencao-industrial')),

  -- Cluster 7 — Serra circular para marcenaria
  ('serra circular profissional', 'serra-circular-profissional', 'medio', false,
     (select id from clusters where slug = 'serra-circular-marcenaria')),
  ('serra circular dewalt ou bosch', 'serra-circular-dewalt-ou-bosch', 'medio', true,
     (select id from clusters where slug = 'serra-circular-marcenaria')),
  ('dewalt dwe560 review', 'dewalt-dwe560-review', 'baixo', false,
     (select id from clusters where slug = 'serra-circular-marcenaria')),
  ('disco serra circular madeira', 'disco-serra-circular-madeira', 'baixo', false,
     (select id from clusters where slug = 'serra-circular-marcenaria')),

  -- Cluster 8 — Manutenção de ferramentas elétricas
  ('manutenção ferramentas elétricas', 'manutencao-ferramentas-eletricas', 'medio', false,
     (select id from clusters where slug = 'manutencao-ferramentas-eletricas')),
  ('manutenção de furadeira', 'manutencao-de-furadeira', 'medio', false,
     (select id from clusters where slug = 'manutencao-ferramentas-eletricas')),
  ('assistência técnica bosch natal', 'assistencia-tecnica-bosch-natal', 'medio', false,
     (select id from clusters where slug = 'manutencao-ferramentas-eletricas')),

  -- Cluster 9 — EPI para obras
  ('epi para construção civil', 'epi-para-construcao-civil', 'alto', false,
     (select id from clusters where slug = 'epi-para-obras')),
  ('como escolher epi', 'como-escolher-epi', 'alto', false,
     (select id from clusters where slug = 'epi-para-obras')),
  ('epi obrigatório canteiro', 'epi-obrigatorio-canteiro', 'medio', false,
     (select id from clusters where slug = 'epi-para-obras')),
  ('certificado de aprovação ca', 'certificado-de-aprovacao-ca', 'medio', false,
     (select id from clusters where slug = 'epi-para-obras')),

  -- Cluster 10 — Normas NR de segurança
  ('normas segurança construção civil', 'normas-seguranca-construcao-civil', 'medio', false,
     (select id from clusters where slug = 'normas-nr-seguranca-trabalho')),
  ('nr6 equipamento proteção individual', 'nr6-equipamento-protecao-individual', 'baixo', false,
     (select id from clusters where slug = 'normas-nr-seguranca-trabalho')),
  ('nr12 segurança máquinas', 'nr12-seguranca-maquinas', 'baixo', false,
     (select id from clusters where slug = 'normas-nr-seguranca-trabalho'))
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- c) Migração dos 3 artigos hardcoded (lib/articles.ts).
--    corpo = content (ArticleBlock[]) idêntico, em dollar-quoting $json$...$json$.
--    published_at = isoDate::timestamptz; reading_time = nº de "X min de leitura".
--    cluster_id via subselect; eh_pilar=true só no artigo de EPI.
-- ----------------------------------------------------------------------------

-- Artigo 1: como-escolher-epi-para-sua-obra -> cluster epi-para-obras (PILAR)
insert into artigos (
  slug, titulo, categoria_label, excerpt, imagem, corpo, keywords,
  cluster_id, eh_pilar, status, published_at, reading_time, autor_nome
) values (
  'como-escolher-epi-para-sua-obra',
  'Como escolher o EPI certo para cada etapa da sua obra',
  'Segurança',
  'Escolher o EPI certo protege a sua equipe, evita multas e mantém a obra dentro da norma. Veja o guia completo de equipamento de proteção individual por tipo de risco, com o que checar antes de comprar.',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1600&q=80',
  $json$[
    {"type":"paragraph","text":"Escolher o EPI certo (Equipamento de Proteção Individual) é uma das decisões mais importantes de qualquer obra. Mais do que cumprir a legislação trabalhista, o equipamento de proteção adequado é o que mantém a sua equipe segura, produtiva e longe de acidentes que custam caro."},
    {"type":"paragraph","text":"Neste guia, você vai entender como selecionar o EPI ideal para cada etapa da obra, quais riscos cada equipamento cobre e o que conferir antes de comprar. Use como checklist na hora de montar ou repor o estoque de segurança da sua empresa."},
    {"type":"heading","text":"O que é EPI e por que ele é obrigatório"},
    {"type":"paragraph","text":"EPI é todo dispositivo de uso individual destinado a proteger o trabalhador contra riscos que possam ameaçar sua saúde e segurança. No Brasil, o uso é regulamentado pela Norma Regulamentadora NR-6, e o fornecimento gratuito pela empresa é obrigatório sempre que houver risco na atividade."},
    {"type":"paragraph","text":"Fornecer o EPI correto, treinar o uso e fiscalizar a utilização não é só uma exigência legal. É o que reduz afastamentos, processos e paradas na obra."},
    {"type":"heading","text":"Comece pela análise de risco da atividade"},
    {"type":"paragraph","text":"Antes de comprar qualquer equipamento, identifique os riscos de cada função. As perguntas básicas que orientam a escolha do EPI são:"},
    {"type":"list","items":[
      "Há risco de queda de objetos sobre a cabeça? Use capacete de segurança",
      "Existe poeira, respingo ou partícula no ar? Use óculos de proteção e máscara respiratória",
      "O ruído é alto e contínuo? Use protetor auricular tipo plug ou concha",
      "Há manuseio de materiais cortantes, abrasivos ou químicos? Use luvas específicas para cada risco",
      "O trabalho é em altura acima de 2 metros? Use cinto de segurança e talabarte",
      "Há risco de choque elétrico? Use luvas e calçados isolantes"
    ]},
    {"type":"paragraph","text":"Cada atividade costuma exigir uma combinação de EPIs. Usar o equipamento errado, ou de qualidade duvidosa, é tão arriscado quanto não usar nenhum."},
    {"type":"heading","text":"EPI por parte do corpo: o que proteger"},
    {"type":"list","items":[
      "Cabeça: capacete de segurança com jugular para trabalho em altura",
      "Olhos e rosto: óculos de proteção, viseira ou protetor facial para solda e corte",
      "Audição: protetor auricular de inserção ou tipo concha conforme o nível de ruído",
      "Vias respiratórias: máscara PFF1, PFF2 ou respirador com filtro químico",
      "Mãos: luvas de raspa, nitrílica, látex ou anticorte conforme o risco",
      "Pés: botina com biqueira de composite ou aço e solado antiderrapante",
      "Corpo: cinto de segurança, colete refletivo e vestimenta adequada"
    ]},
    {"type":"heading","text":"Sempre verifique o Certificado de Aprovação (CA)"},
    {"type":"paragraph","text":"Todo EPI vendido no Brasil precisa ter um número de Certificado de Aprovação (CA) válido, emitido pelo Ministério do Trabalho. Esse número garante que o equipamento foi testado e aprovado para o uso a que se destina."},
    {"type":"paragraph","text":"Antes de comprar, confira se o CA está impresso no produto e se continua ativo. Equipamento sem CA ou com CA vencido não tem validade legal e não protege de verdade. Na Natalmaq, todos os EPIs comercializados têm CA ativo e procedência das principais marcas do mercado."},
    {"type":"heading","text":"Conforto também é segurança"},
    {"type":"paragraph","text":"Um EPI desconfortável acaba sendo deixado de lado pelo trabalhador. Por isso, priorize equipamentos com bom ajuste, ventilação e ergonomia. Eles aumentam a adesão da equipe e, na prática, protegem mais."},
    {"type":"paragraph","text":"Vale também padronizar tamanhos, manter EPIs reserva em estoque e substituir qualquer peça danificada na hora. Proteção pela metade não é proteção."},
    {"type":"heading","text":"Onde comprar EPI com procedência em Natal"},
    {"type":"paragraph","text":"A Natalmaq trabalha com uma linha completa de EPI e segurança, de capacetes e luvas a botinas e proteção respiratória, sempre com Certificado de Aprovação ativo e marcas reconhecidas. Monte um orçamento pelo catálogo e fale com a equipe para receber orientação técnica antes de fechar a compra."}
  ]$json$::jsonb,
  array[
    'EPI', 'equipamento de proteção individual', 'como escolher EPI',
    'segurança do trabalho', 'capacete de segurança', 'luva de segurança',
    'Certificado de Aprovação CA', 'EPI para obra'
  ],
  (select id from clusters where slug = 'epi-para-obras'),
  true, 'publicado', '2026-05-26'::timestamptz, 7, 'Equipe Natalmaq'
)
on conflict (slug) do nothing;

-- Artigo 2: manutencao-de-furadeiras-e-parafusadeiras -> manutencao-ferramentas-eletricas
insert into artigos (
  slug, titulo, categoria_label, excerpt, imagem, corpo, keywords,
  cluster_id, eh_pilar, status, published_at, reading_time, autor_nome
) values (
  'manutencao-de-furadeiras-e-parafusadeiras',
  'Manutenção de furadeiras e parafusadeiras: dobre a vida útil',
  'Manutenção',
  'Pequenos cuidados de limpeza, lubrificação e armazenamento fazem sua furadeira e parafusadeira durarem muito mais. Veja a rotina de manutenção de ferramentas elétricas que evita gasto à toa.',
  'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1600&q=80',
  $json$[
    {"type":"paragraph","text":"Ferramentas elétricas são um investimento de trabalho. Com uma rotina simples de manutenção, uma furadeira ou parafusadeira de qualidade pode durar anos a mais do que o esperado, mantendo a força e a precisão do primeiro dia."},
    {"type":"paragraph","text":"A boa notícia é que a maior parte da manutenção preventiva você mesmo faz, sem ferramenta especial. Veja a rotina que recomendamos para quem usa furadeira e parafusadeira no dia a dia."},
    {"type":"heading","text":"Limpeza depois de cada uso"},
    {"type":"paragraph","text":"A poeira é o maior inimigo da ferramenta elétrica. Ela entope a ventilação, esquenta o motor e desgasta as peças internas. Por isso, ao terminar o trabalho:"},
    {"type":"list","items":[
      "Limpe a carcaça e as aberturas de ventilação com um pano seco ou ar comprimido",
      "Remova poeira e limalha de dentro do mandril",
      "Confira se não há resíduo travando o gatilho ou o seletor de velocidade",
      "Guarde a ferramenta em local seco, longe de umidade e maresia",
      "Nunca enrole o cabo de forma apertada perto da saída do motor"
    ]},
    {"type":"heading","text":"Lubrificação e mandril"},
    {"type":"paragraph","text":"O mandril precisa girar livre e prender a broca com firmeza. Periodicamente, limpe as castanhas internas e aplique uma gota de óleo leve. Mandril que patina ou trava compromete o furo e força o motor."},
    {"type":"heading","text":"Cuidados com a bateria"},
    {"type":"paragraph","text":"Em modelos sem fio, a bateria é o componente mais sensível e mais caro de repor. Para preservar a vida útil:"},
    {"type":"list","items":[
      "Evite descarregar a bateria até zerar por completo",
      "Não deixe a bateria no carregador por dias após carregar",
      "Armazene com carga parcial quando for ficar muito tempo sem uso",
      "Evite expor a bateria ao calor extremo ou à luz direta do sol"
    ]},
    {"type":"heading","text":"Cuidado com as brocas e pontas"},
    {"type":"paragraph","text":"Broca cega e ponta gasta obrigam o motor a trabalhar mais e esquentam a ferramenta. Use a broca certa para cada material, mantenha o jogo organizado e troque pontas de parafusadeira assim que começarem a espanar."},
    {"type":"heading","text":"Quando levar à assistência técnica"},
    {"type":"paragraph","text":"Alguns sinais indicam que a ferramenta precisa de atenção profissional. Fique atento a:"},
    {"type":"list","items":[
      "Faíscas excessivas saindo do motor",
      "Cheiro de queimado durante o uso",
      "Perda de força mesmo com bateria ou rede cheias",
      "Ruído anormal, trepidação ou folga no eixo"
    ]},
    {"type":"paragraph","text":"Esses sintomas costumam apontar desgaste das escovas ou do motor. A Natalmaq conta com assistência técnica autorizada para as principais marcas, com reparo feito em galpão próprio. Levar cedo evita um conserto maior depois."}
  ]$json$::jsonb,
  array[
    'manutenção de furadeira', 'manutenção de parafusadeira', 'ferramenta elétrica',
    'como aumentar vida útil ferramenta', 'cuidados com bateria de ferramenta',
    'limpeza de furadeira'
  ],
  (select id from clusters where slug = 'manutencao-ferramentas-eletricas'),
  false, 'publicado', '2026-05-22'::timestamptz, 6, 'Equipe Natalmaq'
)
on conflict (slug) do nothing;

-- Artigo 3: ferramentas-essenciais-para-comecar-na-construcao -> ferramentas-para-eletricista
insert into artigos (
  slug, titulo, categoria_label, excerpt, imagem, corpo, keywords,
  cluster_id, eh_pilar, status, published_at, reading_time, autor_nome
) values (
  'ferramentas-essenciais-para-comecar-na-construcao',
  'Ferramentas essenciais para quem está começando na construção',
  'Guia de compra',
  'Montar um kit de ferramentas de qualidade é o primeiro passo de qualquer profissional. Veja a lista de ferramentas essenciais para construção, do kit manual às elétricas que valem o investimento.',
  'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=1600&q=80',
  $json$[
    {"type":"paragraph","text":"Quem está montando a primeira caixa de ferramentas profissional muitas vezes fica perdido diante de tantas opções. A boa notícia é que um kit de ferramentas inicial bem escolhido já cobre a maioria das tarefas do dia a dia na construção."},
    {"type":"paragraph","text":"A seguir, listamos as ferramentas essenciais para quem está começando, separadas entre manuais e elétricas, para você investir o dinheiro no que realmente faz diferença."},
    {"type":"heading","text":"O kit manual indispensável"},
    {"type":"paragraph","text":"São as ferramentas que não podem faltar em nenhuma caixa, usadas em praticamente todo serviço:"},
    {"type":"list","items":[
      "Martelo de unha e uma marreta pequena",
      "Jogo de chaves de fenda e Philips de vários tamanhos",
      "Alicate universal e alicate de corte",
      "Trena de 5 metros e nível de bolha",
      "Jogo de chaves combinadas e chave de boca",
      "Estilete, esquadro e lápis de marcação"
    ]},
    {"type":"heading","text":"As ferramentas elétricas que valem o investimento"},
    {"type":"paragraph","text":"Se for partir para as ferramentas elétricas, comece por estas três. Elas resolvem a maior parte dos trabalhos e se pagam rápido:"},
    {"type":"list","items":[
      "Furadeira de impacto, para furar concreto, madeira e metal",
      "Parafusadeira sem fio, para montagem e fixação com agilidade",
      "Esmerilhadeira angular, para cortar e desbastar diversos materiais"
    ]},
    {"type":"paragraph","text":"Com o tempo, vale ampliar o kit com serra mármore, lixadeira e uma furadeira de bancada, conforme o tipo de serviço que você mais faz."},
    {"type":"heading","text":"Equipamento de proteção entra no kit inicial"},
    {"type":"paragraph","text":"Ferramenta sem proteção é risco. Já no primeiro kit, inclua óculos de proteção, luvas, protetor auricular e calçado de segurança. É o item mais barato e o que mais evita acidente."},
    {"type":"heading","text":"Invista em qualidade, não em quantidade"},
    {"type":"paragraph","text":"É melhor ter poucas ferramentas de marcas confiáveis do que muitas de baixa qualidade. Ferramenta boa dura mais, trabalha melhor e sai mais barata no longo prazo, porque você não precisa trocar a cada poucos meses."},
    {"type":"paragraph","text":"Na Natalmaq você encontra todas essas categorias com marcas profissionais e atendimento técnico para tirar dúvidas antes de comprar. Monte seu orçamento pelo catálogo e receba orientação para começar com o kit certo."}
  ]$json$::jsonb,
  array[
    'ferramentas essenciais', 'kit de ferramentas', 'ferramentas para construção civil',
    'ferramentas para iniciantes', 'caixa de ferramentas profissional',
    'primeiras ferramentas'
  ],
  (select id from clusters where slug = 'ferramentas-para-eletricista'),
  false, 'publicado', '2026-05-18'::timestamptz, 8, 'Equipe Natalmaq'
)
on conflict (slug) do nothing;
