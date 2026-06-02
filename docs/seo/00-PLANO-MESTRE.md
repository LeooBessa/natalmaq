# 00 — Plano Mestre do Sistema de SEO Automatizado (Natalmaq)

> Documento de reconciliação. Os docs `01`–`05` foram produzidos em paralelo e
> divergem em detalhes (3 layouts de tabela, nomes de rota, convenção de
> timestamp). Este doc fixa as **decisões finais** e o **plano de fases** que a
> implementação vai seguir. Onde houver conflito entre `01`–`05` e este doc,
> **este doc vence**.

Restrições mestras (do usuário): **custo zero em runtime** (sem API paga),
conteúdo no **Supabase** (publica/edita sem deploy), **4 recursos**
(pillar+clusters, schema rico, linkagem interna automática, landing B2B/local),
**PT-BR**, design "Indústria" no público + look limpo no admin.

---

## 1. Decisões finais (reconciliadas)

### 1.1 Tabelas (uma migration: `0019_seo_conteudo.sql`)

Adoto **tabelas separadas** (docs 01 + 05), não a tabela unificada `conteudos`
(doc 04) — cada tipo tem render/rota próprios e fica mais legível.

| Tabela | Papel | Fonte do design |
|---|---|---|
| `autores` | E-E-A-T: Person (nome, cargo, bio, foto, sameAs) | doc 02 |
| `clusters` | tópico-pilar → página `/guias/[slug]` | doc 01 |
| `artigos` | conteúdo editorial (corpo `ArticleBlock[]` JSONB) → `/artigos/[slug]` | doc 01/02 |
| `landing_pages` | landing B2B/local → `/solucoes/[slug]` | doc 01 |
| `palavras_chave` | pesquisa SEO (oportunidade alto/medio/baixo, volume, sinônimos) | doc 01 |
| `entidade_keyword` | keyword → entidade-destino canônica (polimórfico, soft FK) | doc 01 |
| `artigo_links` | grafo materializado de links (auditoria, sitemap, órfãos) | doc 03 |
| `seo_sinonimos` | termos curados → entidade (reforça o dicionário) | doc 03 |

**Cortado do MVP:** `artigo_relacionado` (curadoria manual artigo↔artigo). Os
relacionados são **derivados** (cluster + keywords + tsvector) e materializados em
`artigos.relacionados` (JSONB). Reintroduzir depois só se houver necessidade real
de curadoria manual.

**Colunas materializadas de linkagem** (na própria `artigos`, doc 03):
`links_inline jsonb`, `relacionados jsonb`, `links_locked boolean`,
`links_geradoem timestamptz`.

### 1.2 Convenções
- **Timestamps:** `created_at` / `updated_at` + trigger `set_updated_at()`
  (padrão catálogo — doc 01 §2.6). Não usar `criado_em`.
- **Status:** enum `status_conteudo` = `rascunho|publicado|arquivado`; leitura
  pública só `publicado` e `published_at <= now()` (permite agendar). `noindex`
  separado.
- **RLS:** leitura pública por status; escrita `public.is_admin()`. Grants
  herdados do `0016` + reforço explícito. Funções com `search_path` fixo.
- **tsvector** `portuguese` + `immutable_unaccent` + GIN (igual `produtos`).
- **Corpo do artigo:** JSONB de `ArticleBlock[]`, tipo estendido (doc 02):
  `heading|paragraph|list` + **`faq`** + **`step`** (FAQ/HowTo a partir de texto
  renderizado, respeitando a política do Google).

### 1.3 Rotas públicas
| Rota | Tipo | Estado |
|---|---|---|
| `/artigos`, `/artigos/[slug]` | artigos satélite | **existe** (migra p/ ler do banco) |
| `/guias`, `/guias/[slug]` | pillar/cluster | **novo** |
| `/solucoes`, `/solucoes/[slug]` | landing B2B/local | **novo** (doc 04: melhor que `/lp` ou raiz) |
| `/autores/[slug]` | ProfilePage (E-E-A-T) | **novo** (opcional, fase 2) |
| `/produto/[slug]` | produto | **existe** (ganha `Product`+`Offer`+`generateMetadata`) |

### 1.4 Linkagem interna
- **Pré-computar no save** (admin), materializar em `artigos.links_inline` +
  `artigos.relacionados` + grafo `artigo_links`. Render só lê (custo zero).
- Dicionário termo→entidade de produtos/categorias/marcas/artigos/clusters +
  `seo_sinonimos`, normalização pt-BR espelhando `immutable_unaccent`.
- Regras anti-spam (`lib/seo/config.ts`): ≤8 links, 1/destino, 1/termo, sem
  auto-link, sem heading, âncoras reais, `links_locked` respeita edição manual.
- tsvector (RPC `produtos_relevantes_para_texto`) reforça os blocos
  "relacionados". Admin revisa/aprova (molde `RevisaoList`).

### 1.5 Schema rico (expectativa alinhada)
- **Base elegível:** `BlogPosting` + `BreadcrumbList` (desktop) + `Product`+`Offer`
  (maior ganho — produto hoje não tem JSON-LD) + `Store/LocalBusiness` (reforçado).
- **FAQPage / HowTo:** mantidos no markup (fortes para AI Overviews), **mas sem
  prometer rich snippet** (FAQ desligado mai/2026; HowTo desde 2023). Só a partir
  de conteúdo **renderizado** (política Google).
- **CollectionPage + ItemList:** pillars, landings, índices. Sem prometer carrossel.
- Helpers determinísticos em `lib/seo/` (constants, metadata, jsonld, score).
- **Sem `AggregateRating` inventado** (só com avaliações reais → manual action).

### 1.6 Decisões técnicas que tomei (não precisam do usuário)
soft FK em `entidade_keyword` (degrada gracioso); `created_at`/`updated_at`;
rotas `/guias` e `/solucoes`; `artigo_relacionado` cortado; uma migration única.

### 1.7 Dados do mundo real a coletar do usuário (podem entrar depois)
- Coordenadas geo da loja (Alecrim, Natal) p/ `GeoCoordinates`.
- Perfis sociais + Google Business Profile (`sameAs`/`hasMap`).
- Confirmar endereço/horário (já em `lib/loja.ts`).
- Temas/keywords prioritários do usuário (além dos 10 clusters do PDF).

---

## 2. Roadmap de conteúdo (doc 04) — 44 páginas

- **10 pillars** (`/guias/[slug]`) — 1 por cluster.
- **28 artigos** (`/artigos/[slug]`) — inclui os **3 existentes migrados**.
- **6 landings** (`/solucoes/[slug]`) — alta intenção comercial.
- **Ondas:** Onda 1 = 18 (alta oportunidade + intenção comercial), Onda 2 = 16,
  Onda 3 = 10. (Tabelas completas no doc 04 §3–§5, §9.)

---

## 3. Plano de implementação por fases

### Fase 1 — Fundação (invisível mas alto valor)
- `0019_seo_conteudo.sql` (todas as tabelas + RPCs + RLS + seed dos 3 artigos e
  10 clusters/keywords).
- `lib/seo/` helpers: `constants`, `metadata`, `jsonld`, `score`, `normalize`,
  `config`, `types`. `components/seo/JsonLd.tsx`.
- `lib/conteudo.ts` (leituras Supabase + ISR + **fallback** ao array atual).
- Migrar `/artigos/*` e `app/sitemap.ts` para ler do banco (fallback mantido).
- **Quick win:** `Product`+`Offer`+`generateMetadata` em `/produto/[slug]`;
  `layout.tsx` vira `@graph` (Organization + Store com `@id`).
- ✅ Resultado: site lê do banco, schema mais rico, **sem conteúdo novo ainda**.

### Fase 2 — Superfícies públicas + motor de links
- Rotas `/guias`, `/guias/[slug]`, `/solucoes`, `/solucoes/[slug]`,
  `/autores/[slug]`.
- Motor de linkagem (`lib/seo/dictionary|internal-links|persist`) + componentes
  `LinkedText`, `RelatedProducts`, `LeiaTambem`, `CategoriasRelacionadas`,
  `RelatedSection`, `ClusterIndex`. FAQ/HowTo no JSON-LD dos artigos.
- ✅ Resultado: arquitetura hub-and-spoke renderizando (vazia até ter conteúdo).

### Fase 3 — Admin (auto-serviço, custo zero)
- `/admin/seo` (dashboard de cobertura de clusters), `/admin/seo/artigos`
  (editor de blocos DnD + SEO score ao vivo + previews Google/OG + revisão de
  links), `/admin/seo/clusters` (master-detail), `/admin/seo/landing`.
- "Exportar brief" (opcional) → string p/ colar no ChatGPT/Claude do dono.
- ✅ Resultado: o dono cria/edita/publica conteúdo sem dev e sem deploy.

### Fase 4+ — Produção de conteúdo (ondas)
- Eu escrevo (nas nossas sessões, custo zero p/ Natalmaq) a Onda 1 (18 páginas) a
  partir do PDF + temas do usuário; semeio no banco. Depois Ondas 2 e 3.

---

## 4. Inventário de arquivos (consolidado)

**Migration:** `supabase/migrations/0019_seo_conteudo.sql`

**libs novas:** `lib/seo/{constants,metadata,jsonld,score,normalize,config,types,
dictionary,internal-links,persist}.ts`, `lib/conteudo.ts`

**componentes novos:** `components/seo/{JsonLd,LinkedText,RelatedProducts,
LeiaTambem,CategoriasRelacionadas,RelatedSection,ClusterIndex}.tsx`

**rotas públicas novas:** `app/(public)/guias/{page,[slug]/page}.tsx`,
`app/(public)/solucoes/{page,[slug]/page}.tsx`, `app/(public)/autores/[slug]/page.tsx`

**rotas públicas alteradas:** `app/(public)/artigos/{page,[slug]/page}.tsx`,
`app/(public)/produto/[slug]/page.tsx`, `app/(public)/catalogo/page.tsx`,
`app/layout.tsx`, `app/sitemap.ts`

**admin novo:** `app/admin/seo/**` (dashboard, artigos, clusters, landing,
`_lib`, `_components`) + grupo na `AdminNav`

**evolui:** `lib/articles.ts` (tipo `ArticleBlock` estendido + fallback/seed),
`lib/data.ts` (helpers de leitura), `app/admin/_lib/` (extrair `slugify`/`<Field>`)
