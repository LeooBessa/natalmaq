# 04 — Arquitetura de Conteúdo (Mapa do Site SEO) — Natalmaq

> Estrategista de conteúdo/SEO. Transforma os 10 clusters da pesquisa de palavras-chave
> em uma arquitetura concreta de conteúdo (pillar + clusters), schema rico, linkagem
> interna automática e landing pages B2B/local, com custo zero em runtime.
>
> Stack alvo: Next.js 15 (App Router/RSC) + TypeScript + Supabase (Postgres + RLS +
> tsvector) + Tailwind (design "Indústria": navy + laranja, Archivo Black/JetBrains Mono).
> Conteúdo mora no Supabase, gerenciável pelo admin, publica/edita sem deploy.

---

## 0. Resumo executivo

- **Pillar pages**: 10 (uma por cluster), em `/guias/[slug]`.
- **Artigos satélite**: 28 (2 a 4 por cluster), em `/artigos/[slug]` — inclui os **3 artigos existentes migrados**.
- **Landing pages B2B/local**: 6 de alta intenção comercial, em `/solucoes/[slug]`.
- **Total a produzir**: **44 páginas de conteúdo** (10 pillars + 28 artigos + 6 landings),
  das quais **3 já existem** (reaproveitadas) → **41 novas a redigir**.
- **Destinos de link interno** (já no site): `/catalogo?categoria=…`, `/marca/[slug]`,
  `/produto/[slug]`, `/solucoes/[slug]`, `/guias/[slug]`, `/artigos/[slug]`.
- **Schema rico**: `Article` + `BreadcrumbList` (todos) + `FAQPage` (todos) + `HowTo`
  (quando há passos) + `ItemList`/`CollectionPage` (pillars e landings) — mantendo
  `Store`/`LocalBusiness` sitewide já existente em `app/layout.tsx`.

---

## 1. Decisões de arquitetura de URL (justificadas)

### 1.1 Três tipos de conteúdo = três rotas

| Tipo | Rota | Por quê |
|---|---|---|
| **Pillar page** (guia-mãe, abrangente, atualizada) | `/guias/[slug]` | Separa hub de tópico (perene, "guia completo") do fluxo de artigos. Concentra autoridade do cluster, sinaliza ao Google que é a página canônica do tema. Rota nova, limpa, escalável. |
| **Artigo satélite** (informacional, foco em 1 dúvida) | `/artigos/[slug]` | **Já existe** (`app/(public)/artigos/[slug]/page.tsx`). Reaproveita render, `generateMetadata`, JSON-LD `Article`+`BreadcrumbList`, OG/Twitter. Zero retrabalho. |
| **Landing B2B/local** (transacional, foco em conversão WhatsApp) | `/solucoes/[slug]` | Intenção comercial é diferente de intenção informacional: layout próprio (blocos, CTA de orçamento, FAQ, prova local). Slug `solucoes` evita conflito com `/catalogo` e `/produto`, e comunica "resolvemos seu problema de compra B2B". |

**Por que NÃO usar uma flag `pilar` dentro de `/artigos`?**
Misturar pillar e satélite na mesma rota dilui o sinal de hierarquia para o crawler,
complica breadcrumbs (`Início > Guias > Artigo` vs `Início > Artigos > Artigo`) e dificulta
o `ItemList`/`CollectionPage` da pillar. URLs distintas tornam a topologia "hub & spoke"
explícita e legível por humanos e por bots.

**Por que NÃO `/comprar/[slug]` ou `/natal/[slug]` para landings?**
`/comprar` colide semanticamente com o fluxo de carrinho/checkout e pode confundir.
`/natal/` engessa só o ângulo geográfico (temos landings de comparativo de marca que não
são geo). `/solucoes/` é guarda-chuva tanto para geo-local (fornecedor RN) quanto para
intenção (comprar com CNPJ, Bosch x DeWalt). Cada landing geo carrega "Natal/RN" no slug
e no H1 quando aplicável (ex.: `/solucoes/comprar-ferramentas-cnpj-natal-rn`).

### 1.2 Estrutura final de URLs (mapa do site de conteúdo)

```
/                                         (home — já existe)
/catalogo                                 (catálogo — já existe; ?categoria=slug)
/marca/[slug]                             (marca — já existe)
/produto/[slug]                           (produto — já existe)
/institucional                            (institucional — já existe; #artigos)

/guias                                    (NOVO — índice de pillars / hub central)
/guias/[slug]                             (NOVO — pillar page)

/artigos                                  (índice — já existe)
/artigos/[slug]                           (artigo satélite — já existe)

/solucoes                                 (NOVO — índice de landings B2B)
/solucoes/[slug]                          (NOVO — landing B2B/local)
```

### 1.3 Topologia "hub & spoke" e fluxo de link interno

```
                 ┌─────────────────────────────────────────────┐
                 │  /guias/[slug]  (PILLAR — hub do cluster)     │
                 │  ItemList p/ satélites + CollectionPage       │
                 └───────┬───────────────┬──────────────┬───────┘
            (linka p/)   │               │              │ (linka p/)
                 ┌───────▼──────┐ ┌──────▼───────┐ ┌────▼──────────┐
                 │ /artigos/a1  │ │ /artigos/a2  │ │ /artigos/a3   │ (SATÉLITES)
                 └───┬──────┬───┘ └───┬──────┬───┘ └───┬──────┬────┘
        (cada artigo)│      │ (volta p/ pillar)         │      │
                     ▼      ▼                           ▼      ▼
        /catalogo?categoria=…   /marca/[slug]   /produto/[slug]   /solucoes/[slug]
              (CATEGORIA)          (MARCA)          (PRODUTO)        (CONVERSÃO)
```

Regras de linkagem (todas determinísticas, código TS — ver §6):
1. **Satélite → Pillar** (sempre, breadcrumb + bloco "faz parte do guia").
2. **Pillar → todos os satélites** (ItemList).
3. **Artigo/Pillar → catálogo/marca/produto** por casamento de palavra-chave/slug.
4. **Landing → catálogo/marca filtrados + WhatsApp** (CTA de orçamento).
5. **Cross-cluster**: artigos relacionados de clusters vizinhos (ex.: cluster 2 ↔ cluster 7).

---

## 2. Modelo de dados no Supabase (conteúdo gerenciável sem deploy)

> Restrição 3: conteúdo mora no Supabase, editável pelo admin, publica sem novo deploy.
> O site público lê com ISR (`revalidate`). Mantém convenções das migrations:
> nomes pt, `slug unique`, RLS, grants explícitos (cobertos por `0016`), trigger `updated_at`.

Migration sugerida: `supabase/migrations/0019_conteudo.sql`.

### 2.1 Tabelas

```sql
-- Clusters (pilares temáticos). 1 cluster -> 1 pillar page.
create table conteudo_clusters (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,          -- vira /guias/[slug]
  titulo        text not null,                 -- H1 da pillar
  meta_title    text not null,
  meta_desc     text not null,
  primary_kw    text not null,
  intencao      text not null default 'informacional', -- informacional | comercial | transacional
  resumo        text,                          -- intro da pillar
  hero_image    text,
  ordem         int not null default 0,
  prioridade    int not null default 3,        -- 1 = mais alta
  publicado     boolean not null default false,
  -- destinos de link automático do cluster (slugs do catálogo):
  categorias_alvo  text[] not null default '{}',  -- slugs de categorias
  marcas_alvo      text[] not null default '{}',  -- slugs de marcas
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Conteúdo unificado: pillar | artigo | landing (1 tabela, discriminada por `tipo`).
-- Reaproveita o tipo ArticleBlock atual (heading|paragraph|list) + novos blocos.
create table conteudos (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  tipo          text not null check (tipo in ('pillar','artigo','landing')),
  cluster_id    uuid references conteudo_clusters(id) on delete set null,
  categoria_label text not null default 'Guia',  -- selo exibido (Segurança, Manutenção…)
  titulo        text not null,                 -- H1
  meta_title    text not null,
  meta_desc     text not null,
  excerpt       text not null,
  hero_image    text not null,
  iso_date      date not null default current_date,
  reading_time  text,
  author        text not null default 'Equipe Natalmaq',
  primary_kw    text not null,
  secondary_kw  text[] not null default '{}',
  intencao      text not null default 'informacional',
  -- corpo: jsonb com blocos (compatível com ArticleBlock; aceita novos tipos)
  blocos        jsonb not null default '[]'::jsonb,
  -- FAQ (gera FAQPage schema) e HowTo (gera HowTo schema) — opcionais:
  faq           jsonb not null default '[]'::jsonb,  -- [{q, a}]
  howto         jsonb,                               -- {nome, passos:[{nome, texto}]}
  -- destinos de link manual/curado (slugs); o automático complementa via §6:
  produtos_alvo   text[] not null default '{}',  -- slugs de produtos
  categorias_alvo text[] not null default '{}',
  marcas_alvo     text[] not null default '{}',
  cta_whatsapp_msg text,                        -- msg pré-preenchida do wa.me (landings)
  prioridade    int not null default 3,
  publicado     boolean not null default false,
  busca_tsv     tsvector generated always as (
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(titulo,''))), 'A') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(excerpt,''))), 'B') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(primary_kw,''))), 'A')
  ) stored,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_conteudos_tipo   on conteudos(tipo) where publicado;
create index idx_conteudos_cluster on conteudos(cluster_id) where publicado;
create index idx_conteudos_busca   on conteudos using gin (busca_tsv);

-- triggers updated_at (mesmo padrão do 0001)
create trigger conteudo_clusters_atualizado_em before update on conteudo_clusters
  for each row execute function set_atualizado_em();  -- coluna atualizado_em
create trigger conteudos_atualizado_em before update on conteudos
  for each row execute function set_atualizado_em();
```

### 2.2 RLS (mesmo padrão de `produtos`/`marcas`)

```sql
alter table conteudo_clusters enable row level security;
alter table conteudos         enable row level security;

-- Leitura pública só do que está publicado
create policy "clusters read"  on conteudo_clusters for select using (publicado);
create policy "conteudos read" on conteudos         for select using (publicado);

-- CRUD total para admin (helper public.is_admin() já existe — 0002)
create policy "admin all clusters"  on conteudo_clusters
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all conteudos" on conteudos
  for all using (public.is_admin()) with check (public.is_admin());
```

> Grants para a Data API: cobertos automaticamente pelo `alter default privileges`
> do `0016_explicit_grants.sql` (tabelas futuras criadas por `postgres`).

### 2.3 Leitura no site público (ISR, fallback)

`lib/conteudo.ts` (novo, espelha `lib/data.ts`): `listClusters()`, `getCluster(slug)`,
`listConteudos({tipo, cluster})`, `getConteudo(slug)`, `listSatelites(clusterId)`.
Páginas com `export const revalidate = 600` (10 min). `app/sitemap.ts` passa a também
listar `/guias/*` e `/solucoes/*` lendo do Supabase (best-effort, igual marcas/categorias).
`lib/articles.ts` vira **fallback de seed** durante a migração (ver §7).

---

## 3. Pillar pages — uma por cluster (10)

> Cada pillar = `/guias/[slug]`. Intenção predominante e prioridade na coluna.
> Prioridade: 1 (máxima) → 3, derivada de oportunidade (Alto>Médio>Baixo) + intenção comercial.

| # | Slug `/guias/…` | H1 (título) | Meta title | Meta description | Primary keyword | Intenção | Prioridade |
|---|---|---|---|---|---|---|---|
| 1 | `ferramentas-para-eletricista` | Guia completo de ferramentas para eletricista profissional | Ferramentas para Eletricista: Guia Completo e Kit Profissional | Guia definitivo de ferramentas para eletricista: kit profissional, alicate isolado NR10 e o que não pode faltar. Monte seu orçamento em Natal/RN. | ferramentas para eletricista | Informacional→comercial | 1 |
| 2 | `furadeira-de-impacto-e-parafusadeira` | Furadeira de impacto e parafusadeira: o guia para escolher certo | Furadeira de Impacto vs Parafusadeira: Guia para Escolher | Entenda a diferença entre furadeira de impacto e parafusadeira, qual comprar e quando usar cada uma. Modelos Bosch, Makita e DeWalt em Natal/RN. | furadeira de impacto | Informacional→comercial | 1 |
| 3 | `fornecedor-industrial-rn` | Fornecedor industrial no Rio Grande do Norte: guia de compra | Fornecedor Industrial RN: Ferramentas e Equipamentos em Natal | Como escolher um fornecedor industrial no RN. Distribuidor de ferramentas, máquinas e EPI em Natal com entrega em todo o estado. | fornecedor ferramentas rn | Comercial→transacional | 1 |
| 4 | `comprar-ferramentas-cnpj` | Comprar ferramentas com CNPJ: guia para empresas | Comprar Ferramentas com CNPJ: Guia de Compra B2B | Tudo sobre comprar ferramentas industriais com CNPJ: nota fiscal, faturamento e compra B2B para empresas em Natal/RN. | compra b2b ferramentas industriais | Comercial→transacional | 1 |
| 5 | `bosch-makita-dewalt-profissional` | Bosch, Makita ou DeWalt: qual a melhor marca de ferramenta profissional | Bosch vs DeWalt vs Makita: Melhor Marca Profissional | Comparativo completo: Bosch, DeWalt e Makita para uso profissional. Veja qual marca de ferramenta elétrica vale mais a pena. | melhor marca ferramenta elétrica | Informacional→comercial | 1 |
| 6 | `manutencao-industrial` | Equipamentos para manutenção industrial e predial: guia | Equipamentos para Manutenção Industrial: Guia Completo | Guia de equipamentos e ferramentas para manutenção industrial e predial: abrasivos, ferramentas e EPI. Fornecimento para empresas no RN. | ferramentas manutenção industrial | Comercial | 2 |
| 7 | `serra-circular-marcenaria` | Serra circular para marcenaria: guia de escolha e corte de madeira | Serra Circular para Marcenaria: Guia e Melhores Modelos | Como escolher serra circular para marcenaria e corte de madeira. Comparativo DeWalt e Bosch, discos e dicas profissionais. | serra circular profissional | Informacional→comercial | 2 |
| 8 | `manutencao-ferramentas-eletricas` | Manutenção de ferramentas elétricas: guia para durar mais | Manutenção de Ferramentas Elétricas: Guia Completo | Como fazer a manutenção de ferramentas elétricas e dobrar a vida útil. Revisão, limpeza e assistência técnica Bosch em Natal. | manutenção ferramentas elétricas | Informacional | 2 |
| 9 | `epi-para-obras` | Como escolher EPI para obras: guia de proteção individual | EPI para Obras: Guia Completo de Proteção Individual | Guia completo de EPI para obras e construção civil: o que é obrigatório, como escolher por risco e onde comprar com CA ativo em Natal. | epi para construção civil | Informacional→comercial | 1 |
| 10 | `normas-nr-seguranca-trabalho` | Normas NR de segurança no trabalho: guia prático | Normas NR de Segurança no Trabalho: Guia Prático (NR-6, NR-12) | Guia das principais normas NR de segurança no trabalho: NR-6 (EPI), NR-12 (máquinas) e segurança na construção civil. | normas segurança construção civil | Informacional | 3 |

**Blocos padrão de toda pillar** (no `blocos` jsonb): intro com primary kw → o que é/contexto
→ subtópicos (1 H2 por satélite, com link "leia o guia completo") → tabela/lista comparativa
→ bloco de produtos/categorias relacionados (auto, §6) → FAQ → CTA "monte seu orçamento".
Schema: `Article` + `BreadcrumbList` (`Início > Guias > [pillar]`) + `FAQPage` + `ItemList`
(satélites) + `CollectionPage`.

---

## 4. Artigos satélite por cluster (28)

> Cada artigo: `/artigos/[slug]`. "Reuso" marca os 3 artigos existentes migrados.
> "Linka p/" = destino de link interno principal (categoria / marca / produto / landing).
> Prioridade herda do cluster, ajustada pela intenção comercial do ângulo.

### Cluster 1 — Ferramentas para eletricista (pillar prio 1)

| Slug `/artigos/…` | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `kit-ferramentas-eletricista-profissional` | Kit de ferramentas para eletricista profissional: lista completa | kit ferramentas eletricista profissional | ferramentas eletricista, lista de ferramentas | Informacional→comercial | Checklist do kit ideal por nível (iniciante→profissional) | `/catalogo?categoria=ferramentas-eletricas`, `/solucoes/comprar-ferramentas-cnpj-natal-rn` | 1 |
| `alicate-isolado-nr10` | Alicate isolado NR10: o que é, quando usar e como escolher | alicate isolado nr10 | ferramenta isolada 1000v, nr10 | Informacional→comercial | Segurança + especificação técnica (norma NR10) | `/catalogo?categoria=alicates`, `/guias/normas-nr-seguranca-trabalho` | 1 |
| `ferramentas-manuais-vs-eletricas-eletricista` | Ferramentas manuais e elétricas para eletricista: o que ter de cada | ferramentas para eletricista | parafusadeira eletricista, multímetro | Informacional | Como balancear o kit manual + elétrico | `/marca/bosch`, `/marca/makita` | 2 |

### Cluster 2 — Furadeira de impacto vs parafusadeira (pillar prio 1)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `diferenca-furadeira-de-impacto-e-parafusadeira` | Diferença entre furadeira de impacto e parafusadeira | diferença furadeira parafusadeira | parafusadeira de impacto | Informacional | Comparativo lado a lado, quando usar cada | `/catalogo?categoria=furadeiras`, `/catalogo?categoria=parafusadeiras` | 1 |
| `furadeira-de-impacto-como-escolher` | Furadeira de impacto: como escolher (potência, mandril, impacto) | furadeira de impacto | furadeira impacto profissional | Comercial | Critérios de compra + recomendações por uso | `/catalogo?categoria=furadeiras`, `/produto/furadeira-bosch-gsb-13-re` | 1 |
| `parafusadeira-de-impacto-vale-a-pena` | Parafusadeira de impacto vale a pena? Para quem é indicada | parafusadeira de impacto | parafusadeira a bateria | Informacional→comercial | Casos de uso (montagem/fixação) e custo-benefício | `/catalogo?categoria=parafusadeiras`, `/marca/dewalt` | 2 |

### Cluster 3 — Fornecedor industrial RN (pillar prio 1)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `como-escolher-fornecedor-de-ferramentas-rn` | Como escolher um fornecedor de ferramentas no RN | fornecedor ferramentas rn | distribuidor ferramentas natal | Comercial | Critérios: estoque, NF, prazo, suporte técnico | `/solucoes/fornecedor-ferramentas-rn`, `/catalogo` | 1 |
| `distribuidor-industrial-natal-entrega-interior` | Distribuidor industrial em Natal com entrega no interior do RN | distribuidor industrial natal rn | entrega ferramentas interior rn | Comercial→transacional | Cobertura geográfica + logística (usa fretes_regra) | `/solucoes/distribuidor-industrial-natal-rn`, `/catalogo` | 2 |

### Cluster 4 — Comprar ferramentas com CNPJ (pillar prio 1)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `comprar-ferramentas-com-cnpj-vantagens` | Comprar ferramentas com CNPJ: vantagens e como funciona | comprar ferramentas com cnpj | nota fiscal ferramentas empresa | Comercial→transacional | NF, crédito de ICMS, faturamento, garantia PJ | `/solucoes/comprar-ferramentas-cnpj-natal-rn` | 1 |
| `ferramentas-para-empresa-compra-em-volume` | Ferramentas para empresa: compra em volume e reposição de estoque | ferramentas para empresa natal rn | compra ferramentas em volume | Comercial→transacional | Compra recorrente B2B, condições para frota/equipe | `/solucoes/comprar-ferramentas-cnpj-natal-rn`, `/catalogo` | 2 |

### Cluster 5 — Bosch x DeWalt x Makita profissional (pillar prio 1)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `bosch-ou-dewalt-profissional` | Bosch ou DeWalt para uso profissional: qual escolher | dewalt ou bosch profissional | bosch vs dewalt | Informacional→comercial | Comparativo direto (linha azul Bosch x DeWalt) | `/marca/bosch`, `/marca/dewalt`, `/solucoes/bosch-x-dewalt-profissional` | 1 |
| `makita-vale-a-pena-profissional` | Makita vale a pena para profissional? Comparada a Bosch e DeWalt | melhor marca ferramenta elétrica | makita profissional | Informacional→comercial | Onde Makita ganha/perde; custo-benefício | `/marca/makita`, `/solucoes/bosch-x-dewalt-profissional` | 2 |
| `como-identificar-ferramenta-profissional-vs-domestica` | Linha profissional x doméstica: como identificar e por que importa | bosch vs dewalt | ferramenta profissional ou doméstica | Informacional | Critérios técnicos (ciclo de trabalho, garantia) | `/catalogo?categoria=furadeiras`, `/marca/bosch` | 3 |

### Cluster 6 — Manutenção industrial (pillar prio 2)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `ferramentas-para-manutencao-industrial-lista` | Ferramentas para manutenção industrial: lista essencial | ferramentas manutenção industrial | kit manutenção industrial | Comercial | Checklist por setor (mecânica, elétrica, predial) | `/solucoes/manutencao-industrial-rn`, `/catalogo` | 2 |
| `abrasivos-industriais-tipos-e-aplicacoes` | Abrasivos industriais: tipos, aplicações e como escolher | abrasivos industriais natal | discos abrasivos, lixas industriais | Informacional→comercial | Discos, lixas, rebolos por material | `/catalogo?categoria=abrasivos`, `/catalogo?categoria=acessorios` | 3 |
| `equipamentos-manutencao-predial` | Equipamentos para manutenção predial: o que sua equipe precisa | equipamentos manutenção predial | ferramentas zelador predial | Comercial | Kit para condomínio/facilities | `/solucoes/manutencao-industrial-rn`, `/catalogo` | 3 |

### Cluster 7 — Serra circular para marcenaria (pillar prio 2)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `serra-circular-dewalt-ou-bosch-corte-madeira` | Serra circular DeWalt ou Bosch para corte de madeira *(featured)* | serra circular dewalt ou bosch | serra circular corte madeira | Informacional→comercial | **Featured snippet alvo**: comparativo direto | `/marca/dewalt`, `/marca/bosch`, `/produto/serra-circular-dewalt-dwe560` | 1 |
| `dewalt-dwe560-review` | DeWalt DWE560: review da serra circular para marceneiro | dewalt dwe560 review | serra circular dewalt 184mm | Comercial | Review do produto real do catálogo | `/produto/serra-circular-dewalt-dwe560` | 2 |
| `melhor-serra-circular-para-marceneiro` | Melhor serra circular para marceneiro: como escolher | melhor serra circular marceneiro | serra circular profissional | Informacional→comercial | Critérios (disco, profundidade, base) + ranking | `/catalogo?categoria=serras`, `/marca/dewalt` | 2 |
| `discos-para-serra-circular-madeira` | Discos para serra circular: qual usar em cada madeira | disco serra circular madeira | disco serra 184mm dentes | Informacional | Guia de discos por nº de dentes/material | `/catalogo?categoria=acessorios`, `/catalogo?categoria=serras` | 3 |

### Cluster 8 — Manutenção de ferramentas elétricas (pillar prio 2)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `manutencao-de-furadeiras-e-parafusadeiras` ♻️ **REUSO** | Manutenção de furadeiras e parafusadeiras: dobre a vida útil | manutenção de furadeira | manutenção de parafusadeira | Informacional | *(existente)* rotina de limpeza/lubrificação/bateria | `/catalogo?categoria=furadeiras`, `/guias/manutencao-ferramentas-eletricas` | 1 |
| `revisao-de-furadeira-profissional-quando-fazer` | Revisão de furadeira profissional: quando e por que fazer | revisão furadeira profissional | sinais furadeira com defeito | Informacional→comercial | Sintomas + checklist preventivo | `/solucoes/assistencia-tecnica-bosch-natal`, `/catalogo?categoria=furadeiras` | 2 |
| `assistencia-tecnica-bosch-natal` | Assistência técnica Bosch em Natal: como funciona o reparo | assistência técnica bosch natal | conserto ferramenta bosch rn | Comercial→transacional | Serviço de reparo próprio (galpão) | `/solucoes/assistencia-tecnica-bosch-natal`, `/marca/bosch` | 2 |

### Cluster 9 — EPI para obras (pillar prio 1)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `como-escolher-epi-para-sua-obra` ♻️ **REUSO** | Como escolher o EPI certo para cada etapa da sua obra | como escolher EPI | equipamento de proteção individual obra | Informacional→comercial | *(existente)* EPI por risco/parte do corpo + CA | `/catalogo?categoria=epi`, `/guias/normas-nr-seguranca-trabalho` | 1 |
| `epi-obrigatorio-no-canteiro-de-obras` | EPI obrigatório no canteiro de obras: lista por função | epi obrigatório canteiro | epi para construção civil | Informacional→comercial | Lista por função (pedreiro, eletricista, soldador) | `/catalogo?categoria=epi`, `/solucoes/fornecedor-ferramentas-rn` | 1 |
| `certificado-de-aprovacao-ca-do-epi` | Certificado de Aprovação (CA) do EPI: como conferir | certificado de aprovação ca | ca do epi válido | Informacional | Como validar CA, riscos de EPI sem CA | `/catalogo?categoria=epi`, `/guias/normas-nr-seguranca-trabalho` | 2 |

### Cluster 10 — Normas NR de segurança (pillar prio 3)

| Slug | Título | Primary kw | Secondary kw | Intenção | Ângulo | Linka p/ | Prio |
|---|---|---|---|---|---|---|---|
| `nr6-epi-o-que-diz-a-norma` | NR-6 e EPI: o que a norma exige da empresa | nr6 equipamento proteção individual | nr6 epi obrigações empresa | Informacional | Resumo prático da NR-6 + responsabilidades | `/guias/epi-para-obras`, `/catalogo?categoria=epi` | 2 |
| `nr12-seguranca-em-maquinas-resumo` | NR-12 segurança em máquinas: resumo para gestores | nr12 segurança máquinas | proteção de máquinas nr12 | Informacional | Pontos-chave para quem opera máquinas | `/guias/manutencao-industrial`, `/catalogo` | 3 |
| `normas-de-seguranca-na-construcao-civil` | Normas de segurança na construção civil: guia das principais NRs | normas segurança construção civil | nr18 construção civil | Informacional | Mapa das NRs aplicáveis a obra | `/guias/epi-para-obras`, `/catalogo?categoria=epi` | 3 |

### Reaproveitamento do 3º artigo existente

`ferramentas-essenciais-para-comecar-na-construcao` ♻️ — não casa 1:1 com nenhum cluster
isolado; é um **artigo-ponte cross-cluster** (toca clusters 1, 2, 9). Recomendação: mantê-lo
em `/artigos/ferramentas-essenciais-para-comecar-na-construcao`, vinculá-lo como satélite
**secundário** do cluster 1 (`ferramentas-para-eletricista`) e linkar dele para os pillars 2
(furadeira/parafusadeira) e 9 (EPI). Conta no total como "reuso", não como artigo novo.

---

## 5. Landing pages B2B/local de alta intenção (6)

> `/solucoes/[slug]`. Derivadas das keywords [Alto] de oportunidade comercial.
> Blocos: Hero (H1 + subhead + CTA WhatsApp) → Prova/credibilidade (1.600+ SKUs, estoque
> local, NF) → Categorias/marcas em destaque (auto, §6) → Diferenciais → FAQ → CTA final.
> CTA = `wa.me` com mensagem pré-preenchida (`cta_whatsapp_msg`). Design "Indústria"
> (navy + laranja, Archivo Black/JetBrains Mono, `bg-bone`/`text-ink`/`brand-500`).

| # | Slug `/solucoes/…` | H1 | Meta title | Meta description | Primary kw | Intenção | Prio |
|---|---|---|---|---|---|---|---|
| L1 | `comprar-ferramentas-cnpj-natal-rn` | Comprar ferramentas com CNPJ em Natal/RN | Comprar Ferramentas com CNPJ em Natal/RN \| Natalmaq | Compra B2B de ferramentas industriais com CNPJ em Natal/RN: nota fiscal, faturamento e orçamento rápido pelo WhatsApp. | compra b2b ferramentas industriais | Transacional | 1 |
| L2 | `fornecedor-ferramentas-rn` | Fornecedor de ferramentas no Rio Grande do Norte | Fornecedor de Ferramentas RN \| Natalmaq Natal | Fornecedor de ferramentas, máquinas e EPI no RN. Mais de 1.600 itens em estoque, entrega em todo o estado e orçamento pelo WhatsApp. | fornecedor ferramentas rn | Transacional | 1 |
| L3 | `distribuidor-industrial-natal-rn` | Distribuidor industrial em Natal/RN | Distribuidor Industrial Natal/RN \| Natalmaq | Distribuidor industrial em Natal/RN: ferramentas, abrasivos, máquinas e EPI para empresas. Orçamento rápido e entrega no interior. | distribuidor industrial natal rn | Transacional | 1 |
| L4 | `bosch-x-dewalt-profissional` | Bosch x DeWalt profissional: compare e compre | Bosch x DeWalt Profissional: Compare e Compre \| Natalmaq | Compare Bosch e DeWalt para uso profissional e feche o melhor preço pelo WhatsApp. Ferramentas com nota fiscal em Natal/RN. | dewalt ou bosch profissional | Comercial→transacional | 2 |
| L5 | `manutencao-industrial-rn` | Ferramentas e equipamentos para manutenção industrial no RN | Manutenção Industrial RN: Ferramentas e EPI \| Natalmaq | Fornecimento de ferramentas, abrasivos e EPI para manutenção industrial e predial no RN. Atendimento B2B e orçamento pelo WhatsApp. | ferramentas manutenção industrial | Comercial→transacional | 2 |
| L6 | `assistencia-tecnica-bosch-natal` | Assistência técnica de ferramentas em Natal/RN | Assistência Técnica Bosch em Natal/RN \| Natalmaq | Assistência técnica de ferramentas elétricas em Natal: reparo de furadeiras e parafusadeiras com galpão próprio. Fale pelo WhatsApp. | assistência técnica bosch natal | Comercial→transacional | 3 |

**Blocos detalhados por landing (`blocos` jsonb + `cta_whatsapp_msg`):**

- **L1 (CNPJ)**: Hero "Compre com CNPJ e nota fiscal" → bloco "Como funciona a compra B2B"
  (3 passos → vira HowTo) → categorias em destaque → diferenciais (NF, faturamento, garantia
  PJ) → FAQ → CTA. `cta_whatsapp_msg`: "Olá! Quero comprar ferramentas com CNPJ. Minha empresa é…".
- **L2 (Fornecedor RN)**: Hero local → mapa de cobertura (faixas de `fretes_regra`) → linhas de
  produto (auto) → prova social → FAQ → CTA "Solicitar orçamento".
- **L3 (Distribuidor industrial)**: Hero "Distribuidor para indústria e revenda" → segmentos
  atendidos → categorias industriais → entrega interior → FAQ → CTA.
- **L4 (Bosch x DeWalt)**: Hero comparativo → tabela Bosch x DeWalt (auto, puxa `/marca/bosch`
  e `/marca/dewalt`) → "qual escolher por tipo de trabalho" → FAQ → CTA "Pedir recomendação".
- **L5 (Manutenção industrial)**: Hero B2B → kits por setor → abrasivos/EPI → contrato/recorrência
  → FAQ → CTA.
- **L6 (Assistência técnica)**: Hero serviço → "como funciona o reparo" (passos → HowTo) →
  marcas atendidas → prazo/galpão próprio → FAQ → CTA "Agendar reparo".

Schema das landings: `Article` (ou `WebPage`) + `BreadcrumbList` (`Início > Soluções > [landing]`)
+ `FAQPage` + `HowTo` (L1, L6) + `ItemList`/`CollectionPage` (produtos/categorias em destaque).
`Store`/`LocalBusiness` permanece sitewide (`app/layout.tsx`) reforçando o sinal geo das landings.

---

## 6. Linkagem interna automática (determinística, custo zero)

> Restrição 1: nada de API paga. Tudo é TS determinístico. Restrição 4(c): artigo ↔
> produto/categoria/marca ↔ outro artigo, por palavra-chave/slug.

`lib/conteudo-links.ts` (novo). Funções puras, sem rede além das leituras Supabase já cacheadas:

1. **`linksDoConteudo(conteudo, {marcas, categorias})`** — resolve `produtos_alvo`,
   `categorias_alvo`, `marcas_alvo` (slugs curados no admin) em URLs reais. Curadoria manual
   tem prioridade — previsível e sob controle editorial.

2. **`autoMatch(texto, dicionario)`** — varre `titulo` + `primary_kw` + `secondary_kw` contra
   um dicionário derivado de `listMarcas()`/`listCategorias()` (nome e slug, com `unaccent`/
   lowercase). Casou "bosch" → linka `/marca/bosch`; casou "furadeira" → `/catalogo?categoria=furadeiras`.
   Sem IA: é matching de string normalizada (mesma normalização do `slugify` em `actions.ts` e
   do `immutable_unaccent` do Postgres). Limite: no máximo 1 link por termo, dedup, máx ~6 links
   automáticos por página para não diluir.

3. **`satelitesDoCluster(clusterId)`** e **`pillarDoConteudo(cluster_id)`** — montam a topologia
   hub & spoke: pillar lista satélites (ItemList), satélite aponta de volta para a pillar
   (breadcrumb + bloco "Faz parte do guia: …").

4. **`relacionadosCrossCluster(conteudo)`** — usa `busca_tsv` (full-text pt já no schema) ou
   overlap de `secondary_kw` para sugerir 2-3 artigos de clusters vizinhos. Determinístico
   (ranking por `ts_rank`/contagem de termos), sem custo de runtime.

5. **Geração de `Article`/`FAQPage`/`HowTo`/`BreadcrumbList`/`ItemList` JSON-LD** —
   helpers em `lib/schema.ts` que recebem o registro do Supabase e emitem o `@graph`
   (estendendo o JSON-LD já existente em `artigos/[slug]/page.tsx`). Título/meta/slug/OG
   também derivados por código a partir dos campos do Supabase (sem redação por IA).

---

## 7. Migração dos 3 artigos existentes

1. Criar `0019_conteudo.sql` (tabelas/RLS/triggers da §2).
2. **Seed manual** (no SQL ou via admin) dos 3 artigos de `lib/articles.ts` na tabela
   `conteudos` (tipo `artigo`), convertendo `content[]` → `blocos` jsonb (já compatível:
   `heading|paragraph|list`), preenchendo `cluster_id` (8, 9 e 1/ponte), `primary_kw`,
   `secondary_kw`, `faq` (ver §8), `categorias_alvo`/`marcas_alvo`.
3. `app/(public)/artigos/[slug]/page.tsx` e `app/(public)/artigos/page.tsx` passam a ler de
   `lib/conteudo.ts` com `revalidate`. `lib/articles.ts` vira fallback (se Supabase falhar,
   usa o array — best-effort, igual ao sitemap atual).
4. `app/sitemap.ts` ganha `/guias/*` e `/solucoes/*` (leitura Supabase best-effort) e mantém
   `/artigos/*` (agora do Supabase, com fallback ao array).
5. Admin: novas telas `app/admin/conteudo/` (clusters + conteúdos) seguindo o padrão de
   `app/admin/marcas/` (server actions `saveConteudoAction`/`deleteConteudoAction`, `slugify`,
   `revalidatePath`, auth via `createSupabaseServerClient`, RLS `is_admin()`).

---

## 8. FAQ (FAQPage) e HowTo por página

> 3-5 perguntas por página (FAQPage schema). HowTo só quando há sequência de passos.

### 8.1 Pillars (FAQ)

- **G1 Ferramentas eletricista**: O que não pode faltar no kit de eletricista? · Preciso de
  ferramenta isolada NR10? · Quanto custa montar um kit profissional? · Bosch, Makita ou DeWalt
  para eletricista? · Vocês vendem com nota fiscal para empresa?
- **G2 Furadeira x parafusadeira**: Qual a diferença entre furadeira de impacto e parafusadeira?
  · Furadeira de impacto serve para parafusar? · Preciso das duas? · Qual potência ideal? · Com
  fio ou bateria?
- **G3 Fornecedor industrial RN**: Vocês entregam no interior do RN? · Atendem empresas (CNPJ)?
  · Qual o prazo de entrega em Natal? · Emitem nota fiscal? · Como pedir orçamento?
- **G4 Comprar com CNPJ**: Posso comprar ferramentas com CNPJ? · Emitem nota fiscal? · Tem
  faturamento para empresa? · A garantia muda na compra PJ? · Como faço pedido recorrente?
- **G5 Bosch/DeWalt/Makita**: Qual a melhor marca profissional? · Bosch ou DeWalt? · Makita vale
  a pena? · Como saber se é linha profissional? · A garantia é a mesma?
- **G6 Manutenção industrial**: Que ferramentas preciso para manutenção industrial? · Vocês têm
  abrasivos? · Atendem contrato de manutenção predial? · Entregam para empresa? · Fornecem EPI junto?
- **G7 Serra circular marcenaria**: Qual a melhor serra circular para marceneiro? · DeWalt ou
  Bosch para madeira? · Que disco usar? · Qual profundidade de corte preciso? · DWE560 é boa?
- **G8 Manutenção ferramentas elétricas**: Como aumentar a vida útil da furadeira? · Com que
  frequência fazer revisão? · Vocês têm assistência técnica? · Quando trocar as escovas? · Como
  cuidar da bateria?
- **G9 EPI para obras**: Quais EPIs são obrigatórios na obra? · Como escolher EPI por função? ·
  O que é CA do EPI? · Quem fornece o EPI, empresa ou trabalhador? · Onde comprar EPI com CA em Natal?
- **G10 Normas NR**: O que diz a NR-6 sobre EPI? · O que é a NR-12? · Quais NRs valem na construção
  civil? · De quem é a responsabilidade pelo EPI? · EPI sem CA é válido?

### 8.2 Landings (FAQ + HowTo)

- **L1 CNPJ** — FAQ: Como comprar com CNPJ? · Emitem nota fiscal? · Tem faturamento a prazo? ·
  Qual o pedido mínimo? · Entregam em Natal e interior?
  **HowTo "Comprar com CNPJ"**: 1) Monte a cesta no catálogo; 2) Informe o CNPJ no WhatsApp;
  3) Receba o orçamento com NF; 4) Aprove e combine entrega/retirada.
- **L2 Fornecedor RN** — FAQ: Quais regiões do RN vocês atendem? · Prazo de entrega? · Pedido
  mínimo? · Atendem revenda? · Como pedir orçamento?
- **L3 Distribuidor industrial** — FAQ: Atendem indústria e revenda? · Têm linha completa
  (abrasivos/EPI)? · Fazem entrega no interior? · Vendem em volume? · Emitem NF?
- **L4 Bosch x DeWalt** — FAQ: Bosch ou DeWalt para profissional? · Qual tem melhor garantia? ·
  Qual é mais barata? · Vocês têm as duas marcas? · Como peço recomendação?
- **L5 Manutenção industrial** — FAQ: Vocês montam kit de manutenção? · Têm abrasivos e EPI? ·
  Atendem contrato/recorrência? · Entregam para empresa? · Emitem NF?
- **L6 Assistência técnica** — FAQ: Quais marcas vocês consertam? · Qual o prazo do reparo? ·
  Tem orçamento prévio? · Buscam a ferramenta? · Onde fica o galpão?
  **HowTo "Levar para reparo"**: 1) Descreva o defeito no WhatsApp; 2) Leve/envie a ferramenta;
  3) Receba o orçamento do reparo; 4) Aprove e retire/receba consertada.

### 8.3 Artigos satélite (3-4 FAQ cada) + HowTo onde cabe

- `kit-ferramentas-eletricista-profissional` — FAQ: O que ter no kit básico? · E no profissional?
  · Quanto custa? · Precisa de ferramenta isolada? **HowTo "Montar o kit"** (escolher base manual
  → adicionar elétricas → adicionar isoladas/medição → adicionar EPI).
- `alicate-isolado-nr10` — FAQ: O que é alicate isolado? · Quando a NR10 exige? · Como conferir os
  1000V? · Posso usar alicate comum? *(sem HowTo)*
- `diferenca-furadeira-de-impacto-e-parafusadeira` — FAQ: Qual a diferença? · Uma substitui a
  outra? · Qual comprar primeiro? · Furadeira parafusa bem? *(sem HowTo)*
- `furadeira-de-impacto-como-escolher` — FAQ: Que potência escolher? · Mandril 10 ou 13mm? · Com
  fio ou bateria? · Qual marca? **HowTo "Escolher furadeira"** (definir uso → potência → mandril
  → fio/bateria → marca).
- `manutencao-de-furadeiras-e-parafusadeiras` ♻️ — FAQ: Como limpar a furadeira? · Preciso
  lubrificar? · Como cuidar da bateria? · Quando levar à assistência? **HowTo "Rotina de
  manutenção"** (limpar pós-uso → checar mandril → lubrificar → cuidar bateria → inspecionar brocas).
- `assistencia-tecnica-bosch-natal` — FAQ: Quais marcas? · Prazo? · Tem orçamento? · Onde fica?
  **HowTo "Solicitar reparo"** (igual L6).
- `como-escolher-epi-para-sua-obra` ♻️ — FAQ: Quais EPIs por etapa? · Como ver o CA? · Quem fornece
  o EPI? · EPI desconfortável pode? **HowTo "Escolher EPI"** (analisar risco → mapear por parte do
  corpo → conferir CA → testar conforto → repor estoque).
- `serra-circular-dewalt-ou-bosch-corte-madeira` *(featured)* — FAQ: DeWalt ou Bosch para madeira?
  · Qual disco? · Qual corta mais fundo? · Qual a mais leve? *(comparativo — sem HowTo)*
- `nr6-epi-o-que-diz-a-norma` — FAQ: O que a NR-6 obriga? · Empresa paga o EPI? · Trabalhador pode
  recusar? · O que é CA? *(sem HowTo)*

> Demais satélites (não listados acima) seguem o mesmo padrão: 3 FAQ derivadas do `primary_kw` +
> `secondary_kw`, geradas/curadas no admin, HowTo apenas quando o ângulo for "como fazer/montar/escolher".

---

## 9. Roadmap de produção priorizado

> Prioridade: 1 (produzir primeiro) → 3. Ordenado por oportunidade de keyword (Alto>Médio>Baixo)
> e intenção comercial (transacional/comercial antes de informacional puro).

### Onda 1 — Prioridade 1 (alta oportunidade + alta intenção comercial) — 18 páginas

| Tipo | Página | Cluster | Motivo |
|---|---|---|---|
| Landing | L1 `comprar-ferramentas-cnpj-natal-rn` | 4 | kw [Alto] + transacional puro |
| Landing | L2 `fornecedor-ferramentas-rn` | 3 | kw [Alto] + transacional + geo |
| Landing | L3 `distribuidor-industrial-natal-rn` | 3 | kw [Médio]+[Alto] + transacional |
| Pillar | G3 `fornecedor-industrial-rn` | 3 | hub transacional |
| Pillar | G4 `comprar-ferramentas-cnpj` | 4 | hub transacional |
| Pillar | G1 `ferramentas-para-eletricista` | 1 | kit [Alto] |
| Pillar | G2 `furadeira-de-impacto-e-parafusadeira` | 2 | furadeira [Alto] |
| Pillar | G5 `bosch-makita-dewalt-profissional` | 5 | bosch/dewalt [Alto] |
| Pillar | G9 `epi-para-obras` | 9 | volume + reusa artigo |
| Artigo | `kit-ferramentas-eletricista-profissional` | 1 | [Alto] |
| Artigo | `alicate-isolado-nr10` | 1 | comercial |
| Artigo | `furadeira-de-impacto-como-escolher` | 2 | comercial |
| Artigo | `comprar-ferramentas-com-cnpj-vantagens` | 4 | transacional |
| Artigo | `bosch-ou-dewalt-profissional` | 5 | [Alto] |
| Artigo | `serra-circular-dewalt-ou-bosch-corte-madeira` *(featured)* | 7 | featured snippet |
| Artigo | `como-escolher-epi-para-sua-obra` ♻️ | 9 | **migrar existente** |
| Artigo | `manutencao-de-furadeiras-e-parafusadeiras` ♻️ | 8 | **migrar existente** |
| Artigo | `como-escolher-fornecedor-de-ferramentas-rn` | 3 | comercial |

### Onda 2 — Prioridade 2 (médio) — 16 páginas

Pillars: G6 `manutencao-industrial`, G7 `serra-circular-marcenaria`, G8 `manutencao-ferramentas-eletricas`.
Landings: L4 `bosch-x-dewalt-profissional`, L5 `manutencao-industrial-rn`.
Artigos: `diferenca-furadeira-de-impacto-e-parafusadeira`, `parafusadeira-de-impacto-vale-a-pena`,
`makita-vale-a-pena-profissional`, `ferramentas-manuais-vs-eletricas-eletricista`,
`distribuidor-industrial-natal-entrega-interior`, `ferramentas-para-empresa-compra-em-volume`,
`ferramentas-para-manutencao-industrial-lista`, `dewalt-dwe560-review`,
`melhor-serra-circular-para-marceneiro`, `revisao-de-furadeira-profissional-quando-fazer`,
`assistencia-tecnica-bosch-natal`, `epi-obrigatorio-no-canteiro-de-obras`,
`certificado-de-aprovacao-ca-do-epi`, `nr6-epi-o-que-diz-a-norma`.
*(+ migrar `ferramentas-essenciais-para-comecar-na-construcao` ♻️ como ponte do cluster 1)*

### Onda 3 — Prioridade 3 (baixo / cauda longa) — 10 páginas

Pillar: G10 `normas-nr-seguranca-trabalho`. Landing: L6 `assistencia-tecnica-bosch-natal`.
Artigos: `como-identificar-ferramenta-profissional-vs-domestica`,
`abrasivos-industriais-tipos-e-aplicacoes`, `equipamentos-manutencao-predial`,
`discos-para-serra-circular-madeira`, `nr12-seguranca-em-maquinas-resumo`,
`normas-de-seguranca-na-construcao-civil`.

---

## 10. Contagem total

| Tipo | Total | Novos | Reaproveitados |
|---|---|---|---|
| Pillar pages (`/guias/[slug]`) | 10 | 10 | 0 |
| Artigos satélite (`/artigos/[slug]`) | 28 | 25 | **3** ♻️ |
| Landing pages B2B/local (`/solucoes/[slug]`) | 6 | 6 | 0 |
| **TOTAL** | **44** | **41** | **3** |

> Distribuição por onda: Onda 1 = 18 · Onda 2 = 16 (+1 reuso ponte) · Onda 3 = 10.
> (Os 3 reusos aparecem nas ondas onde o cluster correspondente é produzido.)

---

## 11. Resumo de arquivos a criar/alterar (handoff de implementação)

**Novos:**
- `supabase/migrations/0019_conteudo.sql` — tabelas `conteudo_clusters` + `conteudos`, RLS, triggers, seed dos 3 artigos.
- `lib/conteudo.ts` — leituras Supabase (clusters, conteúdos, satélites) com ISR + fallback.
- `lib/conteudo-links.ts` — linkagem interna automática determinística.
- `lib/schema.ts` — geradores de JSON-LD (Article/FAQPage/HowTo/BreadcrumbList/ItemList/CollectionPage).
- `app/(public)/guias/page.tsx` — índice de pillars (hub).
- `app/(public)/guias/[slug]/page.tsx` — render pillar + schema.
- `app/(public)/solucoes/page.tsx` — índice de landings.
- `app/(public)/solucoes/[slug]/page.tsx` — render landing B2B + schema + CTA WhatsApp.
- `app/admin/conteudo/page.tsx` + `actions.ts` + form/manager — CRUD (padrão `admin/marcas`).

**Alterados:**
- `app/(public)/artigos/[slug]/page.tsx` — ler do Supabase (fallback `lib/articles.ts`), estender JSON-LD com FAQPage/HowTo, breadcrumb/bloco de pillar.
- `app/(public)/artigos/page.tsx` — ler do Supabase.
- `app/sitemap.ts` — incluir `/guias/*` e `/solucoes/*` (best-effort Supabase).
- `lib/articles.ts` — manter como fallback/seed durante a migração.
