-- ============================================================================
-- 0020 — Integração DS WEBSERVICE (Delphi): sync de estoque/preço/características
--
-- Objetivo: sincronizar estoque, preços e características dos produtos a partir
-- da API DS WEBSERVICE, PRESERVANDO as fotos (coluna `imagens`) já curadas.
-- Adiciona colunas de rastreio, tabela de estado de sync e as 14 categorias
-- "limpas" (mapeadas por codigo_linha do DS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colunas DS em produtos (rastreio + características adicionais)
-- ----------------------------------------------------------------------------
alter table produtos add column if not exists codigo_linha  text;
alter table produtos add column if not exists unidade       text;
alter table produtos add column if not exists referencia    text;
alter table produtos add column if not exists preco_custo   numeric(12,2);
alter table produtos add column if not exists codigo_barra  text;
alter table produtos add column if not exists ds_updated_at timestamptz;   -- data_hora_alt do DS
alter table produtos add column if not exists synced_at     timestamptz;   -- última vez que o sync tocou a linha

create index if not exists idx_produtos_codigo_linha on produtos(codigo_linha);

-- ----------------------------------------------------------------------------
-- Coluna icon nas categorias (as 14 categorias DS trazem ícone)
-- ----------------------------------------------------------------------------
alter table categorias add column if not exists icon text;

-- ----------------------------------------------------------------------------
-- Estado de sincronização (cursor incremental + estatísticas)
-- ----------------------------------------------------------------------------
create table if not exists sync_state (
  id          text primary key,           -- ex: 'ds_produtos'
  phase       text not null default 'full',  -- 'full' | 'incremental'
  next_page   int  not null default 1,
  last_alt    timestamptz,                 -- maior data_hora_alt já processado (cursor incremental)
  last_run    timestamptz,
  stats       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table sync_state enable row level security;
-- sem policies: só service-role (backend) acessa.

-- ----------------------------------------------------------------------------
-- 14 categorias "limpas" do DS (idempotente). slug = id da categoria DS.
-- mapeamento codigo_linha -> slug vive no backend (api/core/ds_categorias.py).
-- ----------------------------------------------------------------------------
insert into categorias (nome, slug, icon, ordem) values
  ('Ferramentas Manuais',            'ferramentas',  'wrench',  1),
  ('Correias, Polias e Transmissão', 'transmissao',  'cog',     2),
  ('Peças e Acessórios',             'pecas',        'cog',     3),
  ('Ferragens e Metais',             'ferragens',    'bolt',    4),
  ('Máquinas e Equipamentos',        'maquinas',     'cog',     5),
  ('Parafusos e Fixação',            'fixacao',      'bolt',    6),
  ('Abrasivos e Discos',             'abrasivos',    'square',  7),
  ('EPI e Segurança',                'seguranca',    'shield',  8),
  ('Solda — Eletrodos',              'solda-elet',   'bolt',    9),
  ('Maçarico e Oxicorte',            'oxicorte',     'bolt',    10),
  ('Solda — Arames e Fios',          'solda-arame',  'bolt',    11),
  ('Elétrica e Instrumentos',        'eletrica',     'bolt',    12),
  ('Adesivos e Colas',               'adesivos',     'drop',    13),
  ('Químicos e Lubrificantes',       'quimicos',     'drop',    14)
on conflict (slug) do update
  set nome = excluded.nome,
      icon = excluded.icon,
      ordem = excluded.ordem;

-- semente do estado de sync
insert into sync_state (id, phase, next_page)
values ('ds_produtos', 'full', 1)
on conflict (id) do nothing;
