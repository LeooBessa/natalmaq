# 01 — Schema do banco (SEO / Conteúdo)

> Fase de **design**. Este documento define o schema Supabase (Postgres) para o
> sistema de SEO/conteúdo da Natalmaq. O SQL abaixo está pronto para virar a
> migration `supabase/migrations/0019_seo_conteudo.sql`, mas **NÃO crie a
> migration real ainda** — primeiro o time valida o design.

---

## 0. Contexto e objetivos

A Natalmaq é um portal B2B de orçamento de ferramentas/máquinas/EPI em Natal/RN.
O catálogo (produtos/categorias/marcas) já mora no Supabase. Hoje os **3 artigos
existem hardcoded** em `lib/articles.ts` e o site público os lê diretamente do
arquivo TypeScript.

Vamos mover **todo o conteúdo editorial para o Supabase**, gerenciável pelo admin,
publicável/editável **sem novo deploy** (ISR/`revalidate`), construindo 4 recursos:

| # | Recurso | Tabelas envolvidas |
|---|---------|--------------------|
| a | Arquitetura **pillar + clusters** | `clusters`, `artigos.cluster_id`, `artigos.eh_pilar` |
| b | **Schema rico** (FAQPage + HowTo + Article + BreadcrumbList + ItemList/CollectionPage) | `artigos.faq`, `artigos.howto`, `landing_pages.faq`, montagem em código |
| c | **Linkagem interna automática** (artigo↔produto/categoria/marca/artigo) | `palavras_chave` + `entidade_keyword` + matching por tsvector/trigram em código (derivado), com cache opcional |
| d | **Landing pages B2B/local** | `landing_pages` |

### Restrições inegociáveis respeitadas

1. **Custo zero em runtime.** Nenhuma chamada a API paga. Toda "automação"
   (título/meta/slug/JSON-LD/links internos/sitemap/breadcrumb/reading time) é
   **código TypeScript determinístico**. O Postgres só guarda dados + faz
   matching de texto (tsvector/pg_trgm, já habilitados no projeto).
2. **Texto escrito por humano** (no admin) ou semeado manualmente. O sistema
   automatiza tudo **ao redor** do conteúdo, nunca a redação.
3. **Conteúdo no Supabase**, lido pelo site público com ISR/fallback razoável.
4. **Schema rico** montado em código a partir de colunas JSONB estruturadas.
5. **PT-BR** e design "Indústria" existente (mantido no front, não afeta o DB).

### Convenções herdadas das migrations existentes (copiadas 1:1)

Lendo `0001_init.sql`, `0002_admin.sql`, `0010_enriquecimento.sql`,
`0011_fix_function_search_path.sql`, `0012_recomendacoes.sql`,
`0016_explicit_grants.sql`:

- **Nomes de tabela/coluna em pt-BR**, minúsculo, snake_case (`marcas`,
  `categorias`, `produtos`, `criado_em`/`created_at`).
- **PK** `uuid primary key default gen_random_uuid()`.
- **Slug** `text not null unique` em entidades com URL pública.
- **Timestamps**: o projeto usa **duas convenções** coexistindo:
  - tabelas de catálogo (`produtos`) → `created_at` / `updated_at` + trigger
    `set_updated_at()`;
  - tabelas operacionais (`pedidos`) → `criado_em` / `atualizado_em` + trigger
    `set_atualizado_em()`.
  - **Decisão:** as tabelas de SEO são **conteúdo de catálogo** (vivem perto de
    produtos/marcas), então usam **`created_at`/`updated_at` + `set_updated_at()`**,
    igual `produtos`. Mantém o front e os admins consistentes com o restante do
    catálogo. (Ver rationale §6.)
- **tsvector gerado** com `setweight(...)` + `immutable_unaccent` + dicionário
  `'portuguese'`, indexado com `gin`. Idêntico ao de `produtos.busca_tsv`.
- **RLS** ligada em **todas** as tabelas: leitura pública via policy `for select
  using (<condição de publicação>)`, escrita só para admin via
  `for all using (public.is_admin()) with check (public.is_admin())`.
- **Grants explícitos**: `0016` já fez `grant all ... to anon, authenticated,
  service_role` em **todas as tabelas atuais e futuras** (via `alter default
  privileges for role postgres`). **Como nossas tabelas novas são criadas pelo
  role `postgres` nesta migration, elas herdam o grant automaticamente.** Ainda
  assim, reforçamos com `grant` explícito por idempotência/clareza (e para
  funções `RPC`, que precisam de `grant execute`).
- **Funções** com `set search_path` fixo (hardening de `0011`), `security
  invoker` para RPC pública (igual `recomendar_para_carrinho`) ou `security
  definer` só onde necessário (igual `is_admin`).
- **`if not exists`** em objetos idempotentes quando faz sentido.

---

## 1. Diagrama ER (textual)

```
                          EXISTENTES (catálogo)                  NOVAS (SEO/conteúdo)
                          ───────────────────                    ────────────────────

   ┌──────────┐   ┌────────────┐   ┌──────────┐
   │  marcas  │   │ categorias │   │ produtos │
   └────┬─────┘   └─────┬──────┘   └────┬─────┘
        │               │               │
        │ (FK destino   │ (FK destino   │ (FK destino
        │  de links)    │  de links)    │  de links)
        │               │               │
        └───────────────┴───────────────┴──────────────┐
                                                        │
                                          ┌─────────────▼───────────────┐
                                          │      entidade_keyword       │  (linkagem: keyword → destino)
                                          │  keyword_id  → palavras_chave│
                                          │  alvo_tipo ∈ {produto,       │
                                          │    categoria,marca,artigo,   │
                                          │    cluster,landing}          │
                                          │  alvo_id (uuid, polimórfico) │
                                          └─────────────▲───────────────┘
                                                        │
   ┌──────────────────┐                  ┌─────────────┴───────────────┐
   │   palavras_chave  │◄────────────────│        (keyword_id)         │
   │  termo, slug      │                  └─────────────────────────────┘
   │  oportunidade     │
   │  ∈ {alto,medio,   │        primary_keyword_id (FK opcional)
   │     baixo}        │◄───────────────┬───────────────┬───────────────┐
   │  volume_estimado  │                │               │               │
   │  cluster_id (FK)  │──────┐         │               │               │
   └──────────────────┘       │         │               │               │
                              │         │               │               │
                       ┌──────▼─────────┴─┐   ┌─────────┴────────┐  ┌────┴───────────┐
                       │     clusters     │◄──│     artigos      │  │ landing_pages  │
                       │  (tópico-pilar)  │   │  cluster_id (FK) │  │  cidade, ramo  │
                       │  slug, titulo    │   │  eh_pilar bool   │  │  faq jsonb     │
                       │  artigo_pilar_id │──►│  corpo jsonb     │  │  itens jsonb   │
                       │  faq, intro      │   │  faq, howto jsonb│  │  marca/cat ref │
                       └──────────────────┘   │  status, seo...  │  └────────────────┘
                              ▲                └────────┬─────────┘
                              │ (1 cluster ─< N artigos)│
                              └─────────────────────────┘

   ┌───────────────────────────┐
   │     artigo_relacionado     │   (artigo ↔ artigo: relação curada/manual, opcional)
   │  artigo_id  → artigos      │
   │  relacionado_id → artigos  │
   │  peso int                  │
   └───────────────────────────┘

   ┌───────────────────────────┐
   │           admins           │ (existente — fonte de autoria via auth.uid())
   │  id → auth.users           │
   └───────────────────────────┘
            ▲
            │ autor_id (FK opcional, set null)
            └──── artigos / clusters / landing_pages
```

### Cardinalidades

- `clusters 1 ─< N artigos` (um artigo pertence a no máximo um cluster).
- `clusters 1 ─ 1 artigo` "pilar" (`clusters.artigo_pilar_id`, opcional/unique).
- `palavras_chave N >─ 1 clusters` (cada keyword pode pertencer a um cluster).
- `artigos / clusters / landing_pages N >─ 1 palavras_chave` (`primary_keyword_id`).
- `entidade_keyword`: tabela ponte polimórfica (1 keyword → N entidades-alvo) que
  alimenta a **linkagem interna** e o destino de cada keyword.
- `artigo_relacionado`: ponte auto-referente artigo↔artigo (curadoria manual,
  opcional; o automático é derivado em código — ver §4).

---

## 2. Decisões de design (e justificativas)

### 2.1 Corpo do artigo: JSONB de `ArticleBlock` vs. Markdown

**Decisão: JSONB de blocos (`ArticleBlock[]`), espelhando `lib/articles.ts`.**
Recomendado.

| Critério | JSONB de blocos (escolhido) | Markdown (texto) |
|----------|------------------------------|------------------|
| Compat. com o front atual | **Total** — `app/(public)/artigos/[slug]/page.tsx` já itera `heading/paragraph/list` | Exigiria parser MD (nova dependência ou renderer) |
| Custo de migração dos 3 artigos | **Zero transformação** — o array já é o formato | Precisaria converter blocos → MD |
| Controle de schema rico | Blocos `howto`/`faq` separados, estruturados | Difícil extrair passos/FAQ de prosa |
| Risco de XSS | Texto puro renderizado como nó React (sem `dangerouslySetInnerHTML` no corpo) | MD→HTML precisa sanitização |
| Edição no admin | Editor de blocos simples (textarea por bloco) | Editor MD livre |
| Custo zero | Sim | Sim |

`corpo jsonb` valida-se por um **CHECK leve** (é array) + validação real no
TypeScript (Zod ou guard manual no server action, como já se faz em
`parseForm`). O tipo `ArticleBlock` permanece em `lib/articles.ts` como contrato
único.

> Evolução futura sem migration: para suportar novos tipos de bloco (ex.
> `image`, `callout`, `cta_produto`), basta estender o union `ArticleBlock` no
> TS — o JSONB não muda de forma.

### 2.2 Linkagem interna: tabela explícita vs. derivado por código

**Decisão híbrida (recomendada):**

1. **`palavras_chave` + `entidade_keyword` = camada explícita e curável.** Cada
   palavra-chave aponta para **uma entidade canônica** (o "destino oficial"
   daquele termo: um produto, categoria, marca, artigo, cluster ou landing). Isso
   é dado de SEO de verdade (os 10 clusters da pesquisa) e precisa ser editável
   no admin — não pode ser puro derivado.

2. **A linkagem artigo→(produto/categoria/marca/artigo) é DERIVADA EM CÓDIGO**,
   em tempo de render (RSC) ou de build, **sem nenhuma tabela de junção
   artigo×produto**. O algoritmo determinístico (custo zero):
   - lê `artigos.corpo` + `palavras_chave` (com `slug`/`termo` e seu destino);
   - para cada keyword cujo `termo`/sinônimo aparece no texto do artigo, injeta
     **1 link** para a entidade-destino (resolvido via `entidade_keyword`);
   - desempate/relevância por `oportunidade` + match de tsvector
     (`produtos.busca_tsv`) usando a RPC `buscar_entidades_para_texto` (§3.6).

   **Por quê derivar e não materializar artigo×produto?**
   - Conteúdo do artigo muda → links recalculam sozinhos (sem trigger de
     sincronização, sem dados stale).
   - Catálogo muda (produto desativado/renomeado) → o matching reflete na hora.
   - Zero custo de manutenção de junções N×M que envelhecem.
   - O matching já é barato: reusa `busca_tsv` (GIN) e `pg_trgm` existentes.

3. **`artigo_relacionado` (opcional, curada):** para o editor "fixar" artigos
   relacionados manualmente (ex. o pilar sempre lista seus clusters). O
   automático (similaridade por keyword/cluster) é derivado; esta tabela é só
   para **override/curadoria**. Se o time decidir que não precisa de curadoria
   manual, **esta tabela pode ser cortada** sem impacto (links relacionados
   passam a ser 100% derivados de `cluster_id` + keywords).

> **Resumo:** explícito onde é dado de negócio editável (keyword→destino
> canônico, relação pilar↔cluster), derivado onde é mecânico e volátil
> (links inline artigo→produto).

### 2.3 Polimorfismo de `entidade_keyword.alvo_id`

Postgres não tem FK polimórfica nativa. Opções: (a) coluna `alvo_id uuid` +
`alvo_tipo` (enum) sem FK; (b) 6 colunas FK nuláveis com CHECK "exatamente uma".
**Decisão: (a)**, `alvo_id uuid not null` + `alvo_tipo enum_alvo_seo`, **sem FK**
mas com **trigger leve de validação opcional** (ou validação no app). Justifica-se
porque (b) explode a largura da tabela e a leitura no front fica chata; (a) é o
padrão usado pelo próprio Supabase em tabelas polimórficas e o app já resolve
o destino por código. Integridade referencial "soft" é aceitável aqui (links
quebrados degradam graciosamente: o resolvedor de links ignora alvo inexistente).

### 2.4 Status de publicação + agendamento

Enum `status_conteudo` = `'rascunho' | 'publicado' | 'arquivado'`. A leitura
pública usa policy `status = 'publicado' and (published_at is null or
published_at <= now())`, permitindo **agendar** publicação (como `banners` faz
com `inicia_em`/`termina_em`). `noindex boolean` separado permite publicar a
página (acessível) mas pedir `noindex` ao Google (ex. landing de teste).

### 2.5 SEO por entidade (campos comuns)

Todas as 3 entidades com URL pública (`artigos`, `clusters`, `landing_pages`)
ganham o mesmo bloco de colunas SEO, para o `generateMetadata` e o JSON-LD lerem
de forma uniforme:

`meta_title`, `meta_description`, `canonical`, `og_image`, `noindex`,
`status`, `published_at`, `autor_id`/`autor_nome`, `primary_keyword_id`,
`reading_time` (minutos, int — calculado em código no save), além de
`faq jsonb` e (em artigos) `howto jsonb`.

> `reading_time` é **calculado em código** (palavras/200) no server action e
> persistido como int; o front formata "X min de leitura". Não é gerado por IA.

### 2.6 Por que `created_at`/`updated_at` (e não `criado_em`)

As entidades de conteúdo são lidas pelo mesmo tipo de código RSC que lê
`produtos`/`marcas`/`categorias` (todas em inglês: `created_at`/`updated_at`).
Manter o padrão de **catálogo** evita um terceiro dialeto de timestamp no front e
permite reusar o trigger `set_updated_at()` já existente. As tabelas
**operacionais** (pedidos) é que usam `criado_em`; conteúdo não é operacional.

---

## 3. SQL completo (pronto para virar `0019_seo_conteudo.sql`)

```sql
-- ============================================================================
-- Natalmaq — Fase 19: SEO / Conteúdo
--   - artigos (corpo em blocos JSONB, schema rico, SEO por entidade)
--   - clusters (arquitetura pillar + clusters)
--   - landing_pages (B2B / local)
--   - palavras_chave (pesquisa de SEO: oportunidade + volume)
--   - entidade_keyword (linkagem interna: keyword -> entidade canônica)
--   - artigo_relacionado (curadoria manual artigo<->artigo, opcional)
--
-- Convenções herdadas: pt-BR, slug unique, created_at/updated_at + trigger
-- set_updated_at(), tsvector com immutable_unaccent + 'portuguese' + GIN,
-- RLS (leitura pública por status publicado, escrita só admin via is_admin()),
-- grants explícitos (0016), search_path fixo nas funções (0011).
--
-- Rollback (ordem inversa por FK):
--   drop table if exists artigo_relacionado, entidade_keyword,
--     landing_pages, artigos, palavras_chave, clusters cascade;
--   drop function if exists public.buscar_entidades_para_texto(text, int);
--   drop type if exists status_conteudo, oportunidade_seo, alvo_seo;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos enum
-- ----------------------------------------------------------------------------
create type status_conteudo  as enum ('rascunho', 'publicado', 'arquivado');
create type oportunidade_seo as enum ('alto', 'medio', 'baixo');
create type alvo_seo         as enum (
  'produto', 'categoria', 'marca', 'artigo', 'cluster', 'landing'
);

-- ----------------------------------------------------------------------------
-- clusters — tópico-pilar (cada cluster tem sua própria página /guias/[slug])
-- ----------------------------------------------------------------------------
create table clusters (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  titulo              text not null,
  subtitulo           text,
  intro               text,                          -- prosa de abertura do pilar
  -- artigo que é o "pilar" deste cluster (1:1, opcional; FK adicionada depois
  -- de criar artigos para evitar dependência circular).
  artigo_pilar_id     uuid,
  cor_destaque        text,                          -- opcional (badge do design)
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

create index idx_clusters_status   on clusters(status, ordem) where status = 'publicado';
create index idx_clusters_busca    on clusters using gin (busca_tsv);

-- ----------------------------------------------------------------------------
-- palavras_chave — pesquisa de SEO (os 10 clusters / termos)
-- ----------------------------------------------------------------------------
create table palavras_chave (
  id                uuid primary key default gen_random_uuid(),
  termo             text not null,                  -- "alicate isolado nr10"
  slug              text not null unique,           -- "alicate-isolado-nr10"
  oportunidade      oportunidade_seo not null default 'medio',
  volume_estimado   int,                            -- visitas/mês estimadas (nullable)
  sinonimos         text[] not null default '{}',   -- variações p/ matching de links
  cluster_id        uuid references clusters(id) on delete set null,
  -- termo "featured snippet" do cluster (ex. a pergunta-destaque)
  eh_featured       boolean not null default false,
  observacoes       text,
  -- expressão de busca para casar o termo no texto dos artigos
  termo_tsv tsvector generated always as (
    to_tsvector('portuguese', immutable_unaccent(coalesce(termo,'')))
  ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_kw_cluster      on palavras_chave(cluster_id);
create index idx_kw_oportunidade on palavras_chave(oportunidade);
create index idx_kw_termo_tsv    on palavras_chave using gin (termo_tsv);
create index idx_kw_termo_trgm   on palavras_chave using gin (termo gin_trgm_ops);

-- clusters.primary_keyword_id -> palavras_chave (FK adicionada após ambas existirem)
alter table clusters
  add constraint clusters_primary_keyword_fk
  foreign key (primary_keyword_id) references palavras_chave(id) on delete set null;

-- ----------------------------------------------------------------------------
-- artigos — conteúdo editorial (corpo em blocos JSONB)
-- ----------------------------------------------------------------------------
create table artigos (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  titulo              text not null,
  categoria_label     text,                          -- badge livre ("Segurança")
  excerpt             text not null,
  imagem              text,                          -- hero/OG fallback
  -- corpo em blocos: ArticleBlock[] = heading|paragraph|list (lib/articles.ts).
  -- Validação de forma é leve aqui; validação real no server action (TS).
  corpo               jsonb not null default '[]'::jsonb,
  -- pillar/cluster
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
  -- full-text para matching de linkagem e busca interna
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

create index idx_artigos_status   on artigos(status, published_at desc) where status = 'publicado';
create index idx_artigos_cluster  on artigos(cluster_id);
create index idx_artigos_pilar    on artigos(eh_pilar) where eh_pilar;
create index idx_artigos_busca    on artigos using gin (busca_tsv);

-- clusters.artigo_pilar_id -> artigos (FK + unicidade do pilar por cluster)
alter table clusters
  add constraint clusters_artigo_pilar_fk
  foreign key (artigo_pilar_id) references artigos(id) on delete set null;
create unique index idx_clusters_pilar_unico on clusters(artigo_pilar_id)
  where artigo_pilar_id is not null;

-- ----------------------------------------------------------------------------
-- landing_pages — B2B / local (ex. "comprar ferramentas com cnpj em natal")
-- ----------------------------------------------------------------------------
create table landing_pages (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  titulo              text not null,
  subtitulo           text,
  -- segmentação local/B2B (alimenta LocalBusiness/areaServed e copy)
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

create index idx_landing_status on landing_pages(status, ordem) where status = 'publicado';
create index idx_landing_busca  on landing_pages using gin (busca_tsv);

-- ----------------------------------------------------------------------------
-- entidade_keyword — destino canônico de cada palavra-chave (linkagem interna)
--   keyword -> (produto | categoria | marca | artigo | cluster | landing)
--   Polimórfico: alvo_id uuid + alvo_tipo enum (sem FK por design — §2.3).
-- ----------------------------------------------------------------------------
create table entidade_keyword (
  id           uuid primary key default gen_random_uuid(),
  keyword_id   uuid not null references palavras_chave(id) on delete cascade,
  alvo_tipo    alvo_seo not null,
  alvo_id      uuid not null,
  -- é o destino "principal"/preferencial daquele termo? (desempate em código)
  principal    boolean not null default true,
  peso         int not null default 1,             -- prioridade de link
  created_at   timestamptz not null default now()
);

-- evita duplicar o mesmo vínculo keyword->entidade
create unique index idx_ent_kw_unico on entidade_keyword (keyword_id, alvo_tipo, alvo_id);
create index idx_ent_kw_keyword on entidade_keyword (keyword_id);
create index idx_ent_kw_alvo    on entidade_keyword (alvo_tipo, alvo_id);

-- ----------------------------------------------------------------------------
-- artigo_relacionado — curadoria manual artigo<->artigo (override opcional).
--   O relacionamento automático é DERIVADO em código (cluster + keywords).
--   Esta tabela só existe para o editor "fixar" relações específicas.
-- ----------------------------------------------------------------------------
create table artigo_relacionado (
  artigo_id      uuid not null references artigos(id) on delete cascade,
  relacionado_id uuid not null references artigos(id) on delete cascade,
  peso           int not null default 1,
  created_at     timestamptz not null default now(),
  primary key (artigo_id, relacionado_id),
  constraint artigo_rel_nao_self check (artigo_id <> relacionado_id)
);
create index idx_artigo_rel_origem on artigo_relacionado(artigo_id);

-- ----------------------------------------------------------------------------
-- Triggers updated_at (reusa set_updated_at() de 0001/0011)
-- ----------------------------------------------------------------------------
create trigger clusters_updated_at      before update on clusters
  for each row execute function set_updated_at();
create trigger palavras_chave_updated_at before update on palavras_chave
  for each row execute function set_updated_at();
create trigger artigos_updated_at       before update on artigos
  for each row execute function set_updated_at();
create trigger landing_pages_updated_at before update on landing_pages
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- RPC: matching de linkagem interna (custo zero, determinístico).
--   Dado um texto (corpo do artigo) retorna entidades-destino candidatas,
--   rankeadas por relevância (tsvector) + oportunidade. Usado pelo resolvedor
--   de links interno em código (RSC). security invoker → respeita RLS do caller.
-- ----------------------------------------------------------------------------
create or replace function public.buscar_entidades_para_texto(
  texto  text,
  limite int default 8
)
returns table (
  keyword_id    uuid,
  termo         text,
  oportunidade  oportunidade_seo,
  alvo_tipo     alvo_seo,
  alvo_id       uuid,
  rank          real
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with consulta as (
    select plainto_tsquery('portuguese', immutable_unaccent(coalesce(texto,''))) as q
  )
  select
    k.id as keyword_id,
    k.termo,
    k.oportunidade,
    ek.alvo_tipo,
    ek.alvo_id,
    ts_rank(k.termo_tsv, c.q) as rank
  from palavras_chave k
  join entidade_keyword ek on ek.keyword_id = k.id
  cross join consulta c
  where k.termo_tsv @@ c.q
  order by
    ek.principal desc,
    (k.oportunidade = 'alto') desc,
    (k.oportunidade = 'medio') desc,
    ek.peso desc,
    rank desc
  limit greatest(1, least(coalesce(limite, 8), 50));
$$;

grant execute on function public.buscar_entidades_para_texto(text, int)
  to anon, authenticated, service_role;

-- ============================================================================
-- RLS
-- ============================================================================
alter table clusters           enable row level security;
alter table palavras_chave     enable row level security;
alter table artigos            enable row level security;
alter table landing_pages      enable row level security;
alter table entidade_keyword   enable row level security;
alter table artigo_relacionado enable row level security;

-- Leitura pública: só conteúdo publicado e dentro da data de publicação
create policy "clusters read" on clusters for select using (
  status = 'publicado' and (published_at is null or published_at <= now())
);
create policy "artigos read" on artigos for select using (
  status = 'publicado' and (published_at is null or published_at <= now())
);
create policy "landing read" on landing_pages for select using (
  status = 'publicado' and (published_at is null or published_at <= now())
);
-- Metadados de SEO leem-se livremente (são públicos por natureza e necessários
-- p/ resolver links no front). Sem dados sensíveis.
create policy "palavras_chave read"   on palavras_chave   for select using (true);
create policy "entidade_keyword read" on entidade_keyword for select using (true);
create policy "artigo_relacionado read" on artigo_relacionado for select using (true);

-- Escrita: só admin (igual 0002)
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
create policy "admin all artigo_relacionado" on artigo_relacionado
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Grants explícitos (reforço; 0016 já cobre futuras tabelas via default privs)
-- ============================================================================
grant all on clusters, palavras_chave, artigos, landing_pages,
             entidade_keyword, artigo_relacionado
  to anon, authenticated, service_role;

-- ============================================================================
-- Seed: migração dos 3 artigos hardcoded + os 10 clusters da pesquisa.
--   (Ver §5 — o seed real fica num script idempotente; aqui só o esqueleto.)
-- ============================================================================
-- insert into clusters (slug, titulo, status, published_at) values
--   ('guia-ferramentas-eletricista', 'Guia de ferramentas para eletricista', 'publicado', now()),
--   ... (10 clusters) ...
-- insert into palavras_chave (termo, slug, oportunidade, volume_estimado, cluster_id) values
--   ('kit ferramentas eletricista profissional', 'kit-ferramentas-eletricista-profissional', 'alto', null, (select id from clusters where slug='guia-ferramentas-eletricista')),
--   ... ;
-- insert into artigos (slug, titulo, excerpt, imagem, corpo, keywords, status, published_at, reading_time, autor_nome) values
--   ('como-escolher-epi-para-sua-obra', ...JSONB do corpo...), ... (3 artigos) ;
```

---

## 4. Como o front consome (custo zero, determinístico)

### 4.1 Compatibilidade: `lib/articles.ts` vira leitura do Supabase

Mantemos o tipo `Article`/`ArticleBlock` como **contrato único** e trocamos a
fonte. `lib/articles.ts` ganha funções async que leem do Supabase (igual
`lib/data.ts`), com o mesmo cliente anon + RLS:

```ts
// lib/articles.ts (evolução — assinatura)
export type ArticleBlock = /* inalterado */;
export interface Article { /* + faq?, howto?, cluster?, primaryKeyword? */ }

export async function listArtigos(): Promise<Article[]>;          // status publicado
export async function getArtigo(slug: string): Promise<Article | null>;
export async function listClusters(): Promise<Cluster[]>;
export async function getCluster(slug: string): Promise<Cluster | null>;
export async function getLanding(slug: string): Promise<Landing | null>;
```

- `app/(public)/artigos/page.tsx` e `[slug]/page.tsx` passam a `await` essas
  funções. `generateStaticParams` lê os slugs do banco. O render dos blocos
  **não muda** (mesma estrutura `heading/paragraph/list`).
- ISR: `export const revalidate = 3600` (como o sitemap já faz) — publica/edita
  sem novo deploy, com cache de 1h. Para publicação imediata, `revalidatePath`
  no server action de salvar (padrão já usado em `actions.ts`).

### 4.2 `sitemap.ts` lê do banco

Substitui `import { articles }` por `await listArtigos()`, e acrescenta clusters
(`/guias/[slug]`) e landings (`/lp/[slug]`) ao sitemap, **respeitando `noindex`**
(itens `noindex` saem do sitemap). Mantém o bloco best-effort `try/catch` que já
existe para marcas/categorias.

### 4.3 Linkagem interna (recurso c) — só código

Helper `lib/links.ts` (novo, determinístico):

1. recebe o `corpo` do artigo;
2. chama a RPC `buscar_entidades_para_texto(corpo_em_texto)` (ou casa keywords
   em memória) → lista de `{termo, alvo_tipo, alvo_id, principal}`;
3. resolve `alvo_id`→URL por tipo (`/produto/[slug]`, `/catalogo?categoria=`,
   `/marca/[slug]`, `/artigos/[slug]`, `/guias/[slug]`, `/lp/[slug]`);
4. injeta no máximo N links por artigo (1 por termo, evita repetir destino),
   renderizando o primeiro match de cada `termo` como `<Link>`.
   Tudo em RSC, sem custo de API.

### 4.4 Schema rico (recurso b) — montado em código

- **Article + BreadcrumbList**: já existe em `[slug]/page.tsx`; passa a ler do
  banco e a injetar `FAQPage` (de `artigos.faq`) e `HowTo` (de `artigos.howto`)
  no mesmo `@graph` quando presentes.
- **Cluster (pilar)**: `CollectionPage` + `ItemList` dos artigos-filhos +
  `FAQPage` + `BreadcrumbList`.
- **Landing**: `ItemList`/`CollectionPage` (produtos de `produtos_destaque` ou
  da `categoria_id`) + `FAQPage` + `LocalBusiness`/`areaServed` (de
  `cidade`/`uf`) + `BreadcrumbList`.
- **Store/LocalBusiness sitewide**: permanece em `app/layout.tsx` (inalterado).

---

## 5. Estratégia de migração dos 3 artigos hardcoded

**Sem perda, sem quebra, reversível.**

1. **Seed idempotente** (script TS `scripts/seed-artigos.ts` ou bloco SQL):
   lê o array `articles` de `lib/articles.ts` e faz `upsert` em `artigos` por
   `slug`. Mapeamento de campos:

   | `Article` (TS) | coluna `artigos` |
   |----------------|------------------|
   | `slug` | `slug` |
   | `title` | `titulo` |
   | `category` | `categoria_label` |
   | `excerpt` | `excerpt` |
   | `image` | `imagem` |
   | `isoDate` | `published_at` (e `status='publicado'`) |
   | `readingTime` ("7 min...") | `reading_time` (7, parse do número) |
   | `keywords` | `keywords` (text[]) |
   | `author` ?? "Equipe Natalmaq" | `autor_nome` |
   | `content` (ArticleBlock[]) | `corpo` (jsonb idêntico) |

   O `corpo` vai **byte a byte** igual (mesmo formato JSONB), então o render não
   muda. `date` (string pt-BR) é descartado — o front re-formata `published_at`
   com `Intl.DateTimeFormat('pt-BR')` (custo zero, determinístico).

2. **Associar a clusters**: os 3 artigos casam com clusters da pesquisa:
   - `como-escolher-epi-para-sua-obra` → cluster *"como escolher epi para obras"*
     (candidato a **pilar** desse cluster).
   - `manutencao-de-furadeiras-e-parafusadeiras` → cluster *"manutenção de
     ferramentas elétricas"*.
   - `ferramentas-essenciais-para-comecar-na-construcao` → cluster *"guia de
     ferramentas para eletricista"* (ou um cluster "kit iniciante").

3. **Cutover do front** (mesmo PR ou seguinte): trocar imports de `lib/articles`
   por leituras Supabase (§4.1). Enquanto o seed não roda, o array hardcoded
   continua como **fallback** (o código tenta o banco; se vazio/erro, usa o
   array — mesmo padrão best-effort do sitemap). Depois de confirmado em prod,
   o array pode virar só seed/fixture de teste.

4. **Rollback**: o array TS permanece versionado até a validação; reverter é
   trocar o import de volta. O `drop` das tabelas está documentado no cabeçalho
   da migration.

---

## 6. Resumo das tabelas

| Tabela | Papel | Pública (RLS read) | Escrita |
|--------|-------|--------------------|---------|
| `clusters` | tópico-pilar com página própria | publicado | admin |
| `artigos` | conteúdo editorial (blocos JSONB) | publicado | admin |
| `landing_pages` | landing B2B/local | publicado | admin |
| `palavras_chave` | pesquisa SEO (oportunidade/volume) | sim | admin |
| `entidade_keyword` | linkagem: keyword→entidade canônica | sim | admin |
| `artigo_relacionado` | curadoria manual artigo↔artigo (opcional) | sim | admin |
| `buscar_entidades_para_texto()` | RPC de matching p/ links internos | execute anon | — |

### Itens que precisam de decisão do usuário (ver §2)

- **`artigo_relacionado`**: manter (curadoria manual) ou cortar (100% derivado)?
- **Timestamps**: confirmado `created_at`/`updated_at` (padrão catálogo) vs.
  `criado_em` (padrão operacional). Proposta: catálogo.
- **`entidade_keyword` sem FK**: aceitar integridade "soft" (recomendado) ou
  exigir 6 FKs nuláveis com CHECK.
- **Rotas novas**: `/guias/[slug]` (clusters) e `/lp/[slug]` (landings) — nomes
  a confirmar (impacto em sitemap/robots/breadcrumb).
