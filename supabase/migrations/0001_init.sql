-- ============================================================================
-- Natalmaq — schema inicial
-- ============================================================================

create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- unaccent não é IMMUTABLE por padrão (depende do dicionário) e por isso
-- não pode ser usado em colunas GENERATED. Wrapper imutável padrão:
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$ select public.unaccent('public.unaccent', $1) $$;

-- ----------------------------------------------------------------------------
-- Marcas / Categorias
-- ----------------------------------------------------------------------------
create table marcas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  logo_url    text,
  ativo       boolean not null default true,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

create table categorias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  parent_id   uuid references categorias(id) on delete set null,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Produtos
-- ----------------------------------------------------------------------------
create table produtos (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,        -- chave de import/atualização
  slug                text not null unique,
  nome                text not null,
  descricao           text,
  marca_id            uuid references marcas(id) on delete set null,
  categoria_id        uuid references categorias(id) on delete set null,
  preco               numeric(12,2) not null default 0,
  preco_promocional   numeric(12,2),
  estoque             int not null default 0,
  peso_kg             numeric(8,3) not null default 0,
  imagens             jsonb not null default '[]'::jsonb,
  complementares      uuid[] not null default '{}',
  ativo               boolean not null default true,
  destaque            boolean not null default false,
  busca_tsv           tsvector generated always as (
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(nome,''))), 'A') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(descricao,''))), 'B')
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_produtos_busca_tsv on produtos using gin (busca_tsv);
create index idx_produtos_nome_trgm on produtos using gin (nome gin_trgm_ops);
create index idx_produtos_marca on produtos(marca_id) where ativo;
create index idx_produtos_categoria on produtos(categoria_id) where ativo;

-- ----------------------------------------------------------------------------
-- Avaliações
-- ----------------------------------------------------------------------------
create table avaliacoes (
  id            uuid primary key default gen_random_uuid(),
  produto_id    uuid not null references produtos(id) on delete cascade,
  cliente_nome  text not null,
  nota          int not null check (nota between 1 and 5),
  comentario    text,
  aprovada      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index idx_avaliacoes_produto on avaliacoes(produto_id) where aprovada;

-- ----------------------------------------------------------------------------
-- Banners (carrossel da home)
-- ----------------------------------------------------------------------------
create table banners (
  id          uuid primary key default gen_random_uuid(),
  titulo      text,
  imagem_url  text not null,
  link        text,
  ordem       int not null default 0,
  ativo       boolean not null default true,
  inicia_em   timestamptz,
  termina_em  timestamptz,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Frete (regras simples por faixa de CEP)
-- ----------------------------------------------------------------------------
create table fretes_regra (
  id                 uuid primary key default gen_random_uuid(),
  uf                 text,
  faixa_cep_inicio   text not null,    -- ex 59000000
  faixa_cep_fim      text not null,    -- ex 59999999
  valor              numeric(10,2) not null,
  prazo_dias         int not null default 3,
  por_kg             numeric(10,2) not null default 0,
  ordem              int not null default 0
);

-- ----------------------------------------------------------------------------
-- Pedidos (orçamentos)
-- ----------------------------------------------------------------------------
create type pedido_status as enum ('pendente','aprovado','enviado','recusado');

create table pedidos (
  id                uuid primary key default gen_random_uuid(),
  numero            bigserial not null unique,
  status            pedido_status not null default 'pendente',
  cliente_nome      text not null,
  cliente_telefone  text not null,
  cliente_email     text,
  endereco          jsonb,                          -- {cep, rua, numero, bairro, cidade, uf, complemento}
  subtotal          numeric(12,2) not null default 0,
  desconto          numeric(12,2) not null default 0,
  frete_valor       numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  observacoes       text,
  vendedor_id       uuid,                           -- referencia auth.users na fase 2
  whatsapp_url      text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index idx_pedidos_status on pedidos(status, criado_em desc);

create table pedido_itens (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references pedidos(id) on delete cascade,
  produto_id      uuid references produtos(id) on delete set null,
  codigo          text not null,
  nome_snapshot   text not null,
  quantidade      int not null,
  preco_unit      numeric(12,2) not null,
  preco_total     numeric(12,2) not null
);
create index idx_pedido_itens_pedido on pedido_itens(pedido_id);

-- ----------------------------------------------------------------------------
-- Trigger updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger produtos_updated_at before update on produtos
  for each row execute function set_updated_at();

create or replace function set_atualizado_em() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger pedidos_atualizado_em before update on pedidos
  for each row execute function set_atualizado_em();

-- ============================================================================
-- RLS — Row Level Security
-- ============================================================================
alter table marcas        enable row level security;
alter table categorias    enable row level security;
alter table produtos      enable row level security;
alter table avaliacoes    enable row level security;
alter table banners       enable row level security;
alter table fretes_regra  enable row level security;
alter table pedidos       enable row level security;
alter table pedido_itens  enable row level security;

-- Leitura pública (catálogo)
create policy "marcas read"     on marcas      for select using (ativo);
create policy "categorias read" on categorias  for select using (true);
create policy "produtos read"   on produtos    for select using (ativo);
create policy "banners read"    on banners     for select using (
  ativo
  and (inicia_em is null or inicia_em <= now())
  and (termina_em is null or termina_em >= now())
);
create policy "avaliacoes read" on avaliacoes  for select using (aprovada);
create policy "fretes read"     on fretes_regra for select using (true);

-- Inserção pública: cliente cria orçamento (o backend valida itens via service-role)
create policy "pedidos insert anon"      on pedidos      for insert with check (true);
create policy "pedido_itens insert anon" on pedido_itens for insert with check (true);
create policy "avaliacoes insert anon"   on avaliacoes   for insert with check (not aprovada);

-- Tudo o mais (UPDATE/DELETE, leitura de pedidos, etc) só via service-role
-- (que bypassa RLS). Na Fase 2 acrescentaremos políticas para admins autenticados.

-- ============================================================================
-- Seed
-- ============================================================================
insert into marcas (nome, slug, logo_url, ordem) values
  ('Bosch',  'bosch',  null, 1),
  ('Makita', 'makita', null, 2),
  ('DeWalt', 'dewalt', null, 3);

insert into categorias (nome, slug, ordem) values
  ('Furadeiras',  'furadeiras', 1),
  ('Serras',      'serras', 2),
  ('Lixadeiras',  'lixadeiras', 3),
  ('Acessórios',  'acessorios', 4);

insert into produtos (codigo, slug, nome, descricao, marca_id, categoria_id, preco, preco_promocional, estoque, peso_kg, destaque, imagens) values
  ('BOSCH-GSB13RE',  'furadeira-bosch-gsb-13-re',  'Furadeira de Impacto Bosch GSB 13 RE',  'Furadeira de impacto 650W com mandril de 13mm.', (select id from marcas where slug='bosch'),  (select id from categorias where slug='furadeiras'), 599.90, 499.90, 25, 1.8, true,  '["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800"]'),
  ('MAKITA-HP1640',  'furadeira-makita-hp1640',    'Furadeira de Impacto Makita HP1640',    'Furadeira robusta 680W com 2 velocidades.',     (select id from marcas where slug='makita'), (select id from categorias where slug='furadeiras'), 749.00, null,    18, 1.9, false, '["https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800"]'),
  ('DEWALT-DWE560',  'serra-circular-dewalt-dwe560','Serra Circular DeWalt DWE560',          'Serra circular 1400W disco 184mm.',             (select id from marcas where slug='dewalt'), (select id from categorias where slug='serras'),     1199.00, 1099.00, 8, 3.7, true, '["https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800"]'),
  ('BOSCH-GWS850',   'esmerilhadeira-bosch-gws850','Esmerilhadeira Angular Bosch GWS 850',  'Esmerilhadeira 850W disco 4½".',                (select id from marcas where slug='bosch'),  (select id from categorias where slug='lixadeiras'), 459.90, null, 30, 1.8, false, '["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800"]'),
  ('DISCO-DIAM-110', 'disco-diamantado-110mm',     'Disco Diamantado 110mm',                'Disco para corte em concreto e cerâmica.',      (select id from marcas where slug='makita'), (select id from categorias where slug='acessorios'), 49.90, 39.90, 120, 0.2, false, '["https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800"]'),
  ('BROCAS-KIT',     'kit-brocas-13-pecas',        'Kit de Brocas 13 Peças',                'Kit completo para alvenaria, madeira e metal.', (select id from marcas where slug='bosch'),  (select id from categorias where slug='acessorios'), 89.90, null, 60, 0.4, false, '["https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800"]');

insert into banners (titulo, imagem_url, link, ordem) values
  ('Promo Bosch', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1600', '/marca/bosch', 1),
  ('Frete Grátis Natal/RN', 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=1600', '/catalogo', 2);

insert into fretes_regra (uf, faixa_cep_inicio, faixa_cep_fim, valor, prazo_dias, por_kg, ordem) values
  ('RN', '59000000', '59299999', 25.00, 1, 0,    1),  -- Natal e região metropolitana
  ('RN', '59300000', '59999999', 60.00, 3, 2.50, 2),  -- Interior do RN
  (null, '00000000', '99999999', 120.00, 7, 5.00, 99); -- Resto do Brasil
