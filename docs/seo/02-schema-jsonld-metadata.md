# 02 — Pacote de JSON-LD + Metadata (Natalmaq)

> Especificacao tecnica de structured data (schema.org / JSON-LD) e metadata
> (title, description, canonical, OG/Twitter, robots) para o portal Natalmaq.
> Alinhado as diretrizes ATUAIS do Google Search Central (2025-2026) e otimizado
> para AI Overviews / AI Mode / citacao por LLMs.
>
> **Restricao mestra:** custo ZERO em runtime. Tudo aqui e codigo TypeScript
> DETERMINISTICO que gera schema/metadata a partir dos dados ja existentes no
> Supabase. Nenhuma chamada a API paga. O texto dos artigos continua sendo escrito
> por humano no admin.

---

## 0. TL;DR — decisoes-chave

1. **FAQPage e HowTo NAO geram mais rich snippet** (FAQ desligado por completo em
   mai/2026; HowTo desde set/2023). **Mas continuam valiosos** para compreensao do
   conteudo e citacao em AI Overviews. Logo: **mantemos o markup**, sem prometer
   "estrelinha" no SERP.
2. **Article / BlogPosting + BreadcrumbList** seguem elegiveis e sao a base. Reforcar
   E-E-A-T: `author` como **Person** com `url` (pagina de autor), `dateModified`,
   `publisher` consistente.
3. **Product + Offer** sao o maior ganho ainda nao explorado: a pagina de produto
   hoje **nao tem** JSON-LD. Adicionar `Product` com `Offer` (price, availability).
4. **Store / LocalBusiness** ja existe sitewide; reforcar com `geo`, `hasMap`,
   `sameAs`, `priceRange` e replicar na landing local.
5. **CollectionPage + ItemList** para pillar/cluster (a "carousel" rich result so
   vale Course/Movie/Recipe/Restaurant, entao **nao prometemos** carrossel — usamos
   ItemList por clareza semantica e AI).
6. Todo schema sai de **helpers em `lib/seo/jsonld.ts`** e metadata de
   **`lib/seo/metadata.ts`**, alimentados pelo Supabase (conteudo migra de
   `lib/articles.ts` para tabelas, publicavel sem deploy).

---

## 1. Diretrizes ATUAIS do Google (2025-2026) — o que e elegivel a rich result

Fonte primaria: Google Search Central (`developers.google.com/search`).

| Tipo schema.org | Rich result no SERP? | Status / observacao | Usar na Natalmaq? |
|---|---|---|---|
| **Article / BlogPosting / NewsArticle** | Sim (Top stories, "Article" appearance) | Recomendado: `headline`, `image` (1x1/4x3/16x9), `author` (name+url), `datePublished`, `dateModified`. Sinal forte de E-E-A-T e citacao em AI Mode. | **SIM** — base do artigo |
| **BreadcrumbList** | Sim (desktop). **Removido do mobile em jan/2025** | Min. 2 `ListItem`. Ainda ajuda desktop + entendimento de hierarquia por IA. | **SIM** — todas as paginas |
| **Product + Offer** | Sim (merchant listing / product snippet) | `name`, `image`, `offers` (`price`, `priceCurrency`, `availability`). Deve **bater** com o que o usuario ve. `AggregateRating`/`review` so se reais. | **SIM** — pagina de produto |
| **LocalBusiness / Store** | Parcial (knowledge panel, mapa) — depende muito do Business Profile | `name`, `address`, `telephone`, `openingHours`, `geo`, `priceRange`. | **SIM** — sitewide + landing local |
| **ItemList** (carousel) | Carousel rich result so para **Course/Movie/Recipe/Restaurant** (host carousel) | Para nosso caso (lista de artigos/produtos) **NAO** vira carrossel, mas e valido como `CollectionPage`+`ItemList` para semantica/IA. | **SIM** (semantico, sem prometer carrossel) |
| **CollectionPage** | Nao e rich result por si | Descreve pagina de listagem; bom para pillar/cluster e catalogo. | **SIM** — pillar/cluster/catalogo |
| **FAQPage** | **NAO** — desligado por completo (mai/2026). Rich result/Search Console removidos. | Markup **continua valido** no schema.org; sem snippet, mas **forte para AI Overviews** (formato Q&A e o mais citado). | **SIM** (so para IA/semantica, sem prometer snippet) |
| **HowTo** | **NAO** — deprecado set/2023 (desktop) e desligado depois. | Idem FAQ: mantemos para IA/semantica em conteudo passo-a-passo. | **SIM** (so para IA/semantica) |
| Book/Course Info/ClaimReview/Estimated Salary/Learning Video/Special Announcement/Vehicle Listing | Removidos jun/2025 | Nao se aplicam. | Nao |

### Fontes (URLs)

- General Structured Data Guidelines — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Structured data Google Search supports (gallery) — https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- Article schema — https://developers.google.com/search/docs/appearance/structured-data/article
- Product / Merchant listing — https://developers.google.com/search/docs/appearance/structured-data/product e https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- Breadcrumb — https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Carousel (ItemList) — https://developers.google.com/search/docs/appearance/structured-data/carousel
- FAQPage (status atual) — https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Mudancas em HowTo/FAQ (blog 2023) — https://developers.google.com/search/blog/2023/08/howto-faq-changes
- Simplificacao dos resultados (jun/2025) — https://developers.google.com/search/blog/2025/06/simplifying-search-results
- Google drops FAQ rich results (Search Engine Land) — https://searchengineland.com/google-to-no-longer-support-faq-rich-results-476957
- Google drops FAQ rich results (Search Engine Journal) — https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/
- Schema markup para GEO/AI search (2025) — https://geneo.app/blog/schema-markup-structured-data-best-practices-geo-ai-search-2025/
- FAQ schema para AI search/GEO/AEO (Frase) — https://www.frase.io/blog/faq-schema-ai-search-geo-aeo
- Title/meta length best practice 2025 — https://destination-digital.co.uk/news-blogs-case-studies/title-meta-description-length-google-serps-2025/

> **Regra de ouro do Google (sd-policies):** o structured data deve descrever
> conteudo **visivel ao usuario** na pagina. FAQ/HowTo "fantasma" (sem o texto
> renderizado) viola a politica. Por isso, no nosso modelo, FAQ e passos vem de
> blocos de conteudo que **sao renderizados** no artigo.

---

## 2. Estado atual do codigo (auditoria)

| Arquivo | O que ja faz | Gap |
|---|---|---|
| `app/layout.tsx` | `Store` JSON-LD sitewide; metadata global (`metadataBase`, title template, description, icons). | Sem `geo`, `hasMap`, `sameAs`, `priceRange`. Falta `LocalBusiness`/`@id` para reuso. |
| `app/(public)/artigos/[slug]/page.tsx` | `Article` + `BreadcrumbList` (`@graph`); `generateMetadata` com OG/Twitter, canonical, keywords. | `author` e `Organization` (deveria ser `Person` com `url` p/ E-E-A-T); sem FAQ/HowTo; `dateModified == datePublished`; le de `lib/articles.ts` (hardcoded). |
| `app/(public)/artigos/page.tsx` | Indice de artigos; metadata basica. | Sem `CollectionPage`/`ItemList`/`BreadcrumbList`. |
| `app/(public)/produto/[slug]/page.tsx` | Renderiza produto. | **Sem `Product`/`Offer` JSON-LD** e sem `generateMetadata`. |
| `app/(public)/catalogo/page.tsx` | Listagem. | Sem `CollectionPage`/`ItemList`. |
| `app/sitemap.ts` / `app/robots.ts` | Estaticas + artigos + marcas/categorias; disallow areas privadas. | Atualizar para ler artigos/pillars do Supabase quando migrar. |

**Convencoes a respeitar (migrations):** tabelas em pt, `slug unique`, `ativo boolean`,
`ordem int`, `created_at`/`updated_at` com trigger `set_updated_at()`, RLS ligada,
GRANTs explicitos (ver `0016_explicit_grants.sql`), `tsvector` portugues com
`immutable_unaccent`. Admin = server actions + `slugify` + `FormData` (ver
`app/admin/produtos/actions.ts`).

---

## 3. Modelo de dados no Supabase (conteudo gerenciavel sem deploy)

Migrar o conteudo de `lib/articles.ts` para tabelas. Mantem o tipo `ArticleBlock`
(heading|paragraph|list) e **adiciona** dois blocos: `faq` e `step` (para alimentar
FAQPage/HowTo a partir de texto **renderizado**). Esta secao e a interface entre o
documento 01 (arquitetura pillar/cluster) e este (schema). O SQL final fica no
documento de migrations; aqui ficam os campos que o schema/metadata consomem.

```sql
-- supabase/migrations/0019_seo_conteudo.sql (esboco — campos que o schema usa)

-- Autores (E-E-A-T: Person com bio/credenciais/url)
create table autores (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nome        text not null,
  cargo       text,                         -- "Especialista tecnico em ferramentas"
  bio         text,                         -- 1-3 frases, credenciais
  foto_url    text,
  sameas      jsonb not null default '[]'::jsonb,  -- ["https://linkedin.com/...", ...]
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Pillars (paginas pilar) e Clusters
create table pillars (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  titulo        text not null,
  resumo        text,                       -- vira description/meta
  keyword_alvo  text,                       -- keyword principal do cluster
  ordem         int not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Artigos (substitui lib/articles.ts)
create type artigo_status as enum ('rascunho','publicado','arquivado');

create table artigos (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  pillar_id      uuid references pillars(id) on delete set null,
  autor_id       uuid references autores(id) on delete set null,
  categoria      text not null,             -- "Seguranca", "Manutencao"...
  titulo         text not null,             -- vira H1 e Article.headline
  meta_title     text,                      -- override do <title> (<= 60 chars)
  excerpt        text not null,             -- description/meta (<= 160 chars)
  imagem_url     text not null,
  imagem_alt     text,                      -- alt da imagem hero
  keywords       jsonb not null default '[]'::jsonb,
  conteudo       jsonb not null default '[]'::jsonb,  -- ArticleBlock[] (com faq|step)
  status         artigo_status not null default 'rascunho',
  publicado_em   timestamptz,               -- datePublished
  atualizado_em  timestamptz not null default now(),  -- dateModified
  created_at     timestamptz not null default now()
);
create index idx_artigos_status on artigos (status, publicado_em desc);
create index idx_artigos_pillar on artigos (pillar_id);

create trigger artigos_updated_at before update on artigos
  for each row execute function set_updated_at();  -- reaproveita 0001
-- (autores/pillars idem)

-- RLS: leitura publica so de 'publicado'; admin tudo (padrao do projeto)
alter table autores enable row level security;
alter table pillars enable row level security;
alter table artigos enable row level security;

create policy "autores read"  on autores for select using (ativo);
create policy "pillars read"   on pillars for select using (ativo);
create policy "artigos read"   on artigos for select using (status = 'publicado');

create policy "autores admin"  on autores for all using (public.is_admin()) with check (public.is_admin());
create policy "pillars admin"   on pillars for all using (public.is_admin()) with check (public.is_admin());
create policy "artigos admin"   on artigos for all using (public.is_admin()) with check (public.is_admin());

-- GRANTs herdados de 0016 (alter default privileges). Confirmar no Security Advisor.
```

**Tipo `ArticleBlock` estendido** (em `lib/articles.ts`, retrocompativel):

```ts
export type ArticleBlock =
  | { type: "heading"; text: string; level?: 2 | 3 }   // level default 2
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "faq"; question: string; answer: string }  // -> FAQPage + render
  | { type: "step"; name: string; text: string };      // -> HowTo + render
```

> **Por que FAQ/HowTo viram blocos renderizaveis:** o Google exige que o schema
> descreva conteudo visivel. Renderizamos a FAQ no fim do artigo (`<details>`/H3 + p)
> e os passos como lista ordenada; o schema apenas espelha esse texto. Isso mantem a
> politica e ainda da o ganho de AI Overviews.

---

## 4. Helpers reutilizaveis

### 4.1 `lib/seo/constants.ts`

```ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://natalmaq-main.vercel.app";

export const ORG_ID = `${SITE_URL}/#organization`;
export const STORE_ID = `${SITE_URL}/#store`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const ORG_NAME = "Natalmaq";
export const ORG_LOGO = `${SITE_URL}/brand/natalmaq-lockup.png`;
export const ORG_PHONE = "+55-84-3025-9789";

// Centralizar perfis sociais (E-E-A-T / sameAs)
export const ORG_SAMEAS: string[] = [
  // "https://www.instagram.com/natalmaq",
  // "https://www.facebook.com/natalmaq",
  // "https://maps.google.com/?cid=...",  // Business Profile -> hasMap
];

// Geo da loja (Alecrim, Natal/RN). Preencher coordenadas reais.
export const LOJA_GEO = { latitude: -5.806, longitude: -35.211 };
```

### 4.2 `lib/seo/metadata.ts` — geracao determinista de `Metadata` (Next 15)

Regras de comprimento (heuristica; Google trunca por pixel ~525-535px desktop):
**title <= 60 chars** (sufixo ` | Natalmaq` ja conta), **description 110-160 chars**.
Helpers truncam de forma segura (sem cortar palavra no meio).

```ts
import type { Metadata } from "next";
import { SITE_URL, ORG_NAME } from "./constants";

const TITLE_MAX = 60;
const DESC_MAX = 160;
const DESC_MIN = 110;

export function clampTitle(raw: string, withSuffix = true): string {
  const suffix = withSuffix ? ` | ${ORG_NAME}` : "";
  const budget = TITLE_MAX - suffix.length;
  const base = raw.length <= budget ? raw : cutAtWord(raw, budget);
  return `${base}${suffix}`;
}

export function clampDescription(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length <= DESC_MAX ? clean : cutAtWord(clean, DESC_MAX - 1) + "…";
}

function cutAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
}

type BuildArgs = {
  title: string;            // sem o " | Natalmaq" (template cuida disso)
  description: string;
  path: string;             // ex "/artigos/slug" (relativo; metadataBase resolve)
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;   // ISO
  modifiedTime?: string;    // ISO
  authorName?: string;
  keywords?: string[];
  noindex?: boolean;        // rascunho / pagina sem valor de indexacao
};

export function buildMetadata(a: BuildArgs): Metadata {
  const description = clampDescription(a.description);
  const images = a.image ? [{ url: a.image }] : undefined;
  return {
    title: a.title,                         // o template "%s | Natalmaq" aplica o sufixo
    description,
    keywords: a.keywords,
    alternates: { canonical: a.path },      // metadataBase = SITE_URL (layout)
    robots: a.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: a.title,
      description,
      url: a.path,
      type: a.type ?? "website",
      locale: "pt_BR",
      siteName: ORG_NAME,
      images,
      ...(a.type === "article" && {
        publishedTime: a.publishedTime,
        modifiedTime: a.modifiedTime,
        authors: a.authorName ? [a.authorName] : undefined,
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description,
      images: a.image ? [a.image] : undefined,
    },
  };
}
```

> **hreflang/locale:** o site e mono-idioma (pt-BR). Bastam `html lang="pt-BR"`
> (ja existe), `openGraph.locale = "pt_BR"`. Nao adicionar `alternates.languages`
> enquanto nao houver outra lingua (hreflang com 1 so locale e ruido).
> **noindex p/ rascunho:** quando `status != 'publicado'`, `buildMetadata({ noindex: true })`.

### 4.3 `lib/seo/jsonld.ts` — geradores de schema

Helper de injecao (evita repetir o `<script>` em cada page):

```tsx
// components/seo/JsonLd.tsx
export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : data;
  return (
    <script
      type="application/ld+json"
      // schema sem input do usuario; ainda assim, nunca interpolar HTML cru
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
```

```ts
// lib/seo/jsonld.ts
import {
  SITE_URL, ORG_ID, STORE_ID, ORG_NAME, ORG_LOGO, ORG_PHONE,
  ORG_SAMEAS, LOJA_GEO,
} from "./constants";
import { LOJA_ENDERECO } from "@/lib/loja";
import type { Article, ArticleBlock } from "@/lib/articles";

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

// ---------------------------------------------------------------------------
// Organization / Store / LocalBusiness (sitewide, com @id para referenciar)
// ---------------------------------------------------------------------------
export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: ORG_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: ORG_LOGO },
    telephone: ORG_PHONE,
    ...(ORG_SAMEAS.length && { sameAs: ORG_SAMEAS }),
  };
}

export function storeNode() {
  return {
    "@type": ["Store", "LocalBusiness"],
    "@id": STORE_ID,
    name: ORG_NAME,
    description:
      "Loja de maquinas, ferramentas, equipamentos e EPI's em Natal/RN. Orcamento por WhatsApp e entrega no RN.",
    url: SITE_URL,
    image: ORG_LOGO,
    telephone: ORG_PHONE,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: LOJA_ENDERECO.rua,
      addressLocality: LOJA_ENDERECO.cidade,
      addressRegion: LOJA_ENDERECO.uf,
      postalCode: LOJA_ENDERECO.cep,
      addressCountry: "BR",
    },
    geo: { "@type": "GeoCoordinates", ...LOJA_GEO },
    ...(ORG_SAMEAS.length && { hasMap: ORG_SAMEAS.find((u) => u.includes("maps")) }),
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "07:00", closes: "18:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "07:00", closes: "12:00" },
    ],
    areaServed: { "@type": "State", name: "Rio Grande do Norte" },
    parentOrganization: { "@id": ORG_ID },
  };
}

// ---------------------------------------------------------------------------
// BreadcrumbList
// ---------------------------------------------------------------------------
export function breadcrumbNode(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

// ---------------------------------------------------------------------------
// Article / BlogPosting (+ author Person para E-E-A-T)
// ---------------------------------------------------------------------------
type AuthorInput = {
  name: string;
  slug?: string;       // -> /autores/{slug}
  jobTitle?: string;
  bio?: string;
  sameAs?: string[];
};

export function articleNode(a: Article & { author?: AuthorInput; modifiedISO?: string }) {
  const url = `${SITE_URL}/artigos/${a.slug}`;
  const author: object = a.author
    ? {
        "@type": "Person",
        name: a.author.name,
        ...(a.author.slug && { url: `${SITE_URL}/autores/${a.author.slug}` }),
        ...(a.author.jobTitle && { jobTitle: a.author.jobTitle }),
        ...(a.author.bio && { description: a.author.bio }),
        ...(a.author.sameAs?.length && { sameAs: a.author.sameAs }),
      }
    : { "@type": "Organization", "@id": ORG_ID, name: ORG_NAME };

  return {
    "@type": "BlogPosting",     // BlogPosting > Article para blog de marca
    "@id": `${url}#article`,
    headline: a.title.slice(0, 110),    // Google ignora headline > ~110 chars
    description: a.excerpt,
    image: abs(a.image),
    datePublished: a.isoDate,
    dateModified: a.modifiedISO ?? a.isoDate,
    author,
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: a.category,
    inLanguage: "pt-BR",
    ...(a.keywords?.length && { keywords: a.keywords.join(", ") }),
  };
}

// ---------------------------------------------------------------------------
// FAQPage — a partir de blocos type:"faq" (so se houver >= 2)
// Sem rich snippet (deprecado), mas forte para AI Overviews.
// ---------------------------------------------------------------------------
export function faqNode(blocks: ArticleBlock[]) {
  const faqs = blocks.filter((b): b is Extract<ArticleBlock, { type: "faq" }> => b.type === "faq");
  if (faqs.length < 2) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// ---------------------------------------------------------------------------
// HowTo — a partir de blocos type:"step" (so se houver >= 2)
// ---------------------------------------------------------------------------
export function howToNode(blocks: ArticleBlock[], name: string) {
  const steps = blocks.filter((b): b is Extract<ArticleBlock, { type: "step" }> => b.type === "step");
  if (steps.length < 2) return null;
  return {
    "@type": "HowTo",
    name,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

// ---------------------------------------------------------------------------
// CollectionPage + ItemList (pillar/cluster, indice de artigos, catalogo)
// ---------------------------------------------------------------------------
type ListEntry = { name: string; path: string };

export function collectionNode(args: {
  name: string;
  description?: string;
  path: string;
  items: ListEntry[];
}) {
  return {
    "@type": "CollectionPage",
    "@id": `${abs(args.path)}#collection`,
    name: args.name,
    ...(args.description && { description: args.description }),
    url: abs(args.path),
    inLanguage: "pt-BR",
    isPartOf: { "@id": ORG_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: args.items.length,
      itemListElement: args.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: abs(it.path),
        name: it.name,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Product + Offer (pagina de produto) — maior ganho ainda nao explorado
// ---------------------------------------------------------------------------
import type { ProdutoComMarca } from "@/types";

export function productNode(p: ProdutoComMarca) {
  const url = `${SITE_URL}/produto/${p.slug}`;
  const price = p.preco_promocional ?? p.preco;
  const images = (p.imagens ?? []).map(abs);
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.nome,
    ...(p.descricao && { description: p.descricao }),
    sku: p.codigo,
    ...(images.length && { image: images }),
    ...(p.marca?.nome && { brand: { "@type": "Brand", name: p.marca.nome } }),
    ...(p.categoria?.nome && { category: p.categoria.nome }),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: price.toFixed(2),
      availability:
        p.estoque > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORG_ID },
    },
  };
  // NOTA: sem aggregateRating/review enquanto nao houver avaliacoes REAIS
  // aprovadas (tabela `avaliacoes`). Inventar nota viola sd-policies.
}

// ---------------------------------------------------------------------------
// Service / Offer (landing B2B/local) — orcamento p/ CNPJ
// ---------------------------------------------------------------------------
export function serviceNode(args: {
  name: string;
  description: string;
  path: string;
  areaServed?: string;
}) {
  return {
    "@type": "Service",
    name: args.name,
    description: args.description,
    url: abs(args.path),
    provider: { "@id": STORE_ID },
    areaServed: { "@type": "State", name: args.areaServed ?? "Rio Grande do Norte" },
    serviceType: "Fornecimento de ferramentas, maquinas, equipamentos e EPI para empresas",
  };
}
```

---

## 5. Pacote por tipo de pagina (montagem)

### 5.1 Artigo (`app/(public)/artigos/[slug]/page.tsx`)

`@graph` com: **BlogPosting** + **BreadcrumbList** + **FAQPage?** + **HowTo?** + **Store** (ref).

```tsx
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  articleNode, breadcrumbNode, faqNode, howToNode, storeNode,
} from "@/lib/seo/jsonld";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const a = await getArtigo(slug);       // Supabase; fallback lib/articles
  if (!a) return { title: "Artigo nao encontrado" };
  return buildMetadata({
    title: a.meta_title ?? a.titulo,
    description: a.excerpt,
    path: `/artigos/${a.slug}`,
    image: a.imagem_url,
    type: "article",
    publishedTime: a.isoDate,
    modifiedTime: a.modifiedISO ?? a.isoDate,
    authorName: a.author?.name ?? "Equipe Natalmaq",
    keywords: a.keywords,
    noindex: a.status !== "publicado",
  });
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const a = await getArtigo(slug);
  if (!a) notFound();

  const graph = [
    articleNode(a),
    breadcrumbNode([
      { name: "Inicio", path: "/" },
      { name: "Artigos", path: "/artigos" },
      { name: a.title, path: `/artigos/${a.slug}` },
    ]),
    faqNode(a.content),    // null se < 2 FAQs -> filtrar
    howToNode(a.content, a.title),
    storeNode(),
  ].filter(Boolean);

  return (
    <article className="bg-bone">
      <JsonLd data={graph} />
      {/* ... render existente; ADICIONAR render de blocos faq/step ... */}
    </article>
  );
}
```

**Render dos novos blocos** (mantendo design Industria — navy/laranja, font-display):

```tsx
if (block.type === "faq") {
  return (
    <div key={i} className="mb-4 border-l-2 border-brand-500 pl-4">
      <h3 className="font-display text-lg text-ink">{block.question}</h3>
      <p className="mt-1 text-lg leading-relaxed text-ink/80">{block.answer}</p>
    </div>
  );
}
if (block.type === "step") {
  return (
    <div key={i} className="mb-4 flex gap-3">
      <span className="font-mono text-brand-500">{String(i + 1).padStart(2, "0")}</span>
      <div>
        <h3 className="font-display text-lg text-ink">{block.name}</h3>
        <p className="mt-1 text-lg leading-relaxed text-ink/80">{block.text}</p>
      </div>
    </div>
  );
}
```

### 5.2 Pillar / Cluster (`app/(public)/guias/[pillar]/page.tsx` — nova rota)

`@graph`: **CollectionPage + ItemList** + **BreadcrumbList** + **Store** (ref).
Os 10 clusters do briefing viram 10 pillars (ex.: `guias/ferramentas-eletricista`).

```tsx
const graph = [
  collectionNode({
    name: pillar.titulo,
    description: pillar.resumo,
    path: `/guias/${pillar.slug}`,
    items: artigos.map((a) => ({ name: a.titulo, path: `/artigos/${a.slug}` })),
  }),
  breadcrumbNode([
    { name: "Inicio", path: "/" },
    { name: "Guias", path: "/guias" },
    { name: pillar.titulo, path: `/guias/${pillar.slug}` },
  ]),
  storeNode(),
];
```

### 5.3 Landing B2B / Local (`app/(public)/comprar-ferramentas-natal/page.tsx` etc.)

`@graph`: **Store/LocalBusiness** (reforcado) + **Service** + **FAQPage** (Q&A da
landing, renderizado) + **BreadcrumbList**.

```tsx
const graph = [
  storeNode(),
  serviceNode({
    name: "Compra de ferramentas com CNPJ em Natal/RN",
    description:
      "Fornecimento B2B de ferramentas, maquinas, EPI e equipamentos para empresas em Natal e no RN, com orcamento por WhatsApp e nota fiscal.",
    path: "/comprar-ferramentas-natal",
  }),
  faqNode(landing.faq),    // perguntas como "Voces emitem NF para CNPJ?"
  breadcrumbNode([
    { name: "Inicio", path: "/" },
    { name: "Comprar ferramentas em Natal", path: "/comprar-ferramentas-natal" },
  ]),
].filter(Boolean);
```

### 5.4 Produto (`app/(public)/produto/[slug]/page.tsx`)

`@graph`: **Product + Offer** + **BreadcrumbList** + **Store** (ref). Adicionar
tambem `generateMetadata` (hoje inexistente).

```tsx
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getProdutoBySlug(slug);
  if (!p) return { title: "Produto nao encontrado" };
  const desc = p.descricao ??
    `${p.nome}${p.marca ? " " + p.marca.nome : ""}. Orcamento rapido por WhatsApp na Natalmaq, Natal/RN.`;
  return buildMetadata({
    title: p.nome,
    description: desc,
    path: `/produto/${p.slug}`,
    image: p.imagens?.[0],
    type: "website",
  });
}

// no componente:
const graph = [
  productNode(p),
  breadcrumbNode([
    { name: "Inicio", path: "/" },
    { name: "Catalogo", path: "/catalogo" },
    ...(p.marca ? [{ name: p.marca.nome, path: `/marca/${p.marca.slug}` }] : []),
    { name: p.nome, path: `/produto/${p.slug}` },
  ]),
  storeNode(),
];
```

### 5.5 Catalogo / Indice de artigos

`CollectionPage + ItemList + BreadcrumbList` via `collectionNode(...)` (mesmo helper
do pillar).

### 5.6 Layout sitewide

Trocar o `ORG_JSONLD` atual por `@graph` com `organizationNode()` + `storeNode()`
(usando `@id`), permitindo que as paginas referenciem por `{ "@id": STORE_ID }` sem
duplicar dados.

---

## 6. Checklist de on-page SEO validavel automaticamente (SEO score no admin)

Funcao pura `lib/seo/score.ts` roda sobre o artigo (titulo, excerpt, keywords,
`conteudo: ArticleBlock[]`, `imagem_alt`) e devolve `{ score: 0..100, checks: [] }`.
Exibida no `ProdutoForm`/`ArtigoForm` do admin como barra + lista de itens.

| # | Check | Regra automatica | Peso |
|---|---|---|---|
| 1 | H1 unico | exatamente 1 titulo (o `titulo`); nenhum bloco `heading level 1`. | 10 |
| 2 | Hierarquia H2/H3 | headings nao "pulam" nivel (H3 so depois de H2); >= 2 H2. | 8 |
| 3 | Title length | `meta_title`/`titulo` 30-60 chars. | 8 |
| 4 | Meta description | `excerpt` 110-160 chars, sem cortar palavra. | 8 |
| 5 | Keyword no titulo | keyword[0] aparece no titulo (case/acento-insensitive). | 8 |
| 6 | Keyword no 1o paragrafo | keyword[0] nos primeiros ~150 chars do corpo. | 8 |
| 7 | Densidade sem over-opt | densidade keyword[0] entre 0.4% e 2.5% (alerta se > 3%). | 8 |
| 8 | Alt de imagem | `imagem_alt` preenchido, 5-125 chars, != titulo puro. | 6 |
| 9 | Links internos | >= 2 links internos (produto/categoria/marca/artigo) detectados. | 10 |
| 10 | Tamanho do conteudo | >= 600 palavras (guia util) — alerta, nao bloqueio. | 6 |
| 11 | Paragrafos curtos | nenhum paragrafo > 100 palavras (legibilidade/IA). | 5 |
| 12 | TOC viavel | >= 3 H2 (gera indice automatico). | 3 |
| 13 | FAQ no fim | possui bloco(s) `faq` (>= 2) -> habilita FAQPage. | 6 |
| 14 | Slug saudavel | slug kebab-case, sem stopwords excessivas, <= 80 chars. | 4 |

```ts
// lib/seo/score.ts (esqueleto)
export type SeoCheck = { id: string; label: string; ok: boolean; weight: number; hint?: string };

export function scoreArtigo(input: {
  titulo: string;
  excerpt: string;
  keywords: string[];
  conteudo: ArticleBlock[];
  imagemAlt?: string;
  slug: string;
}): { score: number; checks: SeoCheck[] } {
  const checks: SeoCheck[] = [];
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const kw = norm(input.keywords[0] ?? "");
  const headings = input.conteudo.filter((b) => b.type === "heading");
  const text = input.conteudo
    .flatMap((b) =>
      b.type === "paragraph" ? [b.text]
      : b.type === "list" ? b.items
      : b.type === "faq" ? [b.question, b.answer]
      : b.type === "step" ? [b.name, b.text]
      : [])
    .join(" ");
  const words = norm(text).split(/\s+/).filter(Boolean);

  const add = (id: string, label: string, ok: boolean, weight: number, hint?: string) =>
    checks.push({ id, label, ok, weight, hint });

  add("title-len", "Titulo 30-60 chars", input.titulo.length >= 30 && input.titulo.length <= 60, 8);
  add("desc-len", "Meta 110-160 chars", input.excerpt.length >= 110 && input.excerpt.length <= 160, 8);
  add("kw-title", "Keyword no titulo", !!kw && norm(input.titulo).includes(kw), 8);
  add("kw-first", "Keyword no 1o paragrafo", !!kw && norm(text).slice(0, 150).includes(kw), 8);
  const density = kw ? words.filter((w) => w.includes(kw.split(" ")[0])).length / Math.max(words.length, 1) : 0;
  add("kw-density", "Densidade 0.4%-2.5%", density >= 0.004 && density <= 0.025, 8,
      density > 0.03 ? "Keyword stuffing: reduza repeticoes." : undefined);
  add("h2", "Pelo menos 2 H2", headings.length >= 2, 8);
  add("alt", "Alt de imagem", !!input.imagemAlt && input.imagemAlt.length >= 5 && input.imagemAlt.length <= 125, 6);
  add("words", "Conteudo >= 600 palavras", words.length >= 600, 6);
  add("faq", "FAQ no fim (>=2)", input.conteudo.filter((b) => b.type === "faq").length >= 2, 6);
  // ... (links internos, slug, paragrafos curtos, toc)

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  return { score: Math.round((got / total) * 100), checks };
}
```

UI no admin (segue o design): barra `bg-brand-500`, checks `ok` com check verde,
falhos com `text-brand-500` e `hint` em `font-mono text-[11px]`. Score **nao bloqueia**
publicacao (orientativo).

---

## 7. Linkagem interna automatica (custo zero, deterministica)

Resumido aqui (detalhe completo no doc de linkagem). Mecanismo:

1. **Dicionario de ancoras**: ao salvar/listar, monta um mapa
   `termo -> destino` a partir de `marcas.nome/slug`, `categorias.nome/slug`,
   `produtos.nome/slug`, `artigos.titulo/keywords/slug` (tudo do Supabase).
2. **Auto-link no render** (`lib/seo/autolink.ts`): percorre os blocos `paragraph`,
   casa a 1a ocorrencia de cada termo (case/acento-insensitive, fora de links
   existentes), injeta `<Link>`. Limite: **1 link por termo** e **max ~5 links
   automaticos por artigo** (evita over-optimization).
3. **Bloco "Produtos relacionados"** no fim do artigo: por `keywords` -> busca
   `produtos` via `busca_tsv` (full-text portugues ja existente), renderiza
   `ProductCard`. Alimenta tambem `ItemList`/links contextuais.
4. **Pillar <-> cluster**: pillar lista seus artigos (`pillar_id`); cada artigo
   linka de volta ao pillar (`isPartOf`).

Tudo isso e **TS puro** + leituras Supabase free tier. Nenhuma IA.

---

## 8. Otimizacao para AI Overviews / LLMs (GEO/AEO)

Por que importa: paginas com Q&A estruturado sao citadas ~3x mais; conteudo
"answer-first" e preferido por LLMs que fazem chunking. O schema (mesmo sem rich
snippet) ajuda o Google AI Mode a **verificar fatos e atribuir fonte**.

Diretrizes acionaveis (o sistema favorece/valida):

1. **Definicao objetiva no inicio** — todo artigo abre com 1 paragrafo que
   responde "o que e / qual a diferenca" em <= 2 frases (extraivel como answer).
   Check #6 ja empurra a keyword para o 1o paragrafo.
2. **Blocos FAQ no fim** (`type:"faq"`) renderizados + `FAQPage` schema — formato
   Q&A e o mais citado por IA, mesmo sem rich result.
3. **Listas e passos** (`list`/`step`) em vez de paragrafos longos; check #11
   (paragrafos < 100 palavras) e #2 (hierarquia) garantem texto "chunkavel".
4. **Dados concretos**: normas (NR-6, NR-12), numeros (W, mm, kg), CA do EPI,
   nomes de modelos (DWE560, GSB 13 RE). LLMs priorizam fatos verificaveis.
5. **E-E-A-T explicito**: `author` Person com `jobTitle`/`bio`/`sameAs` +
   pagina `/autores/{slug}` (ProfilePage). `dateModified` real quando editar.
6. **Entidades conectadas** via `@id` (`Organization`/`Store`/`Product`/`Article`)
   — ajuda a IA a montar o grafo de relacoes.
7. **Crawl/Core Web Vitals**: manter ISR (`revalidate`) razoavel, imagens com alt,
   robots permitindo bots de IA (nao bloquear no `robots.ts`). Nada extra a fazer
   alem do que ja existe; so nao bloquear GPTBot/PerplexityBot/Google-Extended se
   o cliente quiser aparecer em IA.

---

## 9. Arquivos a criar / alterar (resumo executavel)

**Criar**
- `lib/seo/constants.ts` — SITE_URL, @ids, org/loja/geo/sameAs.
- `lib/seo/metadata.ts` — `buildMetadata`, `clampTitle`, `clampDescription`.
- `lib/seo/jsonld.ts` — todos os nodes (organization, store, breadcrumb, article, faq, howTo, collection, product, service).
- `lib/seo/score.ts` — `scoreArtigo` (SEO score do admin).
- `lib/seo/autolink.ts` — linkagem interna deterministica.
- `components/seo/JsonLd.tsx` — injetor `<script type=ld+json>`.
- `supabase/migrations/0019_seo_conteudo.sql` — `autores`, `pillars`, `artigos` (+ RLS/grants/trigger).
- `app/(public)/guias/page.tsx` e `app/(public)/guias/[pillar]/page.tsx` — pillars.
- `app/(public)/comprar-ferramentas-natal/page.tsx` (e demais landings locais/B2B).
- `app/(public)/autores/[slug]/page.tsx` — ProfilePage (E-E-A-T).

**Alterar**
- `app/layout.tsx` — `ORG_JSONLD` -> `organizationNode()` + `storeNode()` via `@graph`.
- `app/(public)/artigos/[slug]/page.tsx` — usar helpers; author Person; FAQ/HowTo; render blocos novos; ler do Supabase.
- `app/(public)/artigos/page.tsx` — `collectionNode` + breadcrumb.
- `app/(public)/produto/[slug]/page.tsx` — `productNode` + breadcrumb + `generateMetadata`.
- `app/(public)/catalogo/page.tsx` — `collectionNode`.
- `app/sitemap.ts` — incluir pillars e ler artigos do Supabase (manter fallback).
- `lib/articles.ts` — estender `ArticleBlock` (faq|step); virar fallback/seed.
- `lib/data.ts` — `getArtigo`, `listArtigos`, `getPillar`, `listPillars`, `getAutor`.
- Admin: `app/admin/artigos/` (CRUD com SEO score, padrao `produtos/actions.ts`).

---

## 10. Riscos / pontos de decisao

- **Coordenadas geo reais** da loja (Alecrim) precisam ser confirmadas; placeholder no constants.
- **`sameAs`/`hasMap`**: depende de perfis sociais + Google Business Profile do cliente.
- **`AggregateRating` em Product**: so com avaliacoes REAIS aprovadas (tabela `avaliacoes` ja existe). Nao inventar nota (viola sd-policies e pode gerar manual action).
- **FAQ/HowTo sem rich snippet**: alinhar expectativa do cliente — o ganho e AI/semantica, nao "estrelinha".
- **Migracao de `lib/articles.ts` -> Supabase**: precisa de seed dos 3 artigos atuais e ISR para publicar sem deploy. Manter fallback para nao quebrar build se o Supabase falhar (padrao ja usado no `sitemap.ts`).
- **BreadcrumbList no mobile**: Google removeu (jan/2025); mantemos por desktop + IA, sem prometer mobile.
