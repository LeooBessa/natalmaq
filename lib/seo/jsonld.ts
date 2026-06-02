// Geradores de nós JSON-LD (schema.org) — doc 02 §4.3, ADAPTADOS aos tipos
// reais do projeto. Todas as funções são puras e determinísticas (custo zero).
// Os nós usam @id (#organization/#store/#product/#article) para se referenciarem
// no @graph sem duplicar dados. Componha em arrays e injete via <JsonLd/>.

import {
  SITE_URL,
  ORG_ID,
  STORE_ID,
  ORG_NAME,
  ORG_LOGO,
  ORG_PHONE,
  ORG_SAMEAS,
  LOJA_GEO,
} from "./constants";
import { LOJA_ENDERECO } from "@/lib/loja";
import type { Article } from "@/lib/articles";
import type { ProdutoComMarca } from "@/types";

/** Resolve um path relativo para URL absoluta (no-op se já for http). */
export const abs = (path: string): string =>
  path.startsWith("http") ? path : `${SITE_URL}${path}`;

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
    ...(ORG_SAMEAS.length > 0 && { sameAs: ORG_SAMEAS }),
  };
}

export function storeNode() {
  const mapUrl = ORG_SAMEAS.find((u) => u.includes("maps"));
  return {
    "@type": ["Store", "LocalBusiness"],
    "@id": STORE_ID,
    name: ORG_NAME,
    description:
      "Loja de máquinas, ferramentas, equipamentos e EPI's em Natal/RN. Orçamento por WhatsApp e entrega no RN.",
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
    ...(mapUrl && { hasMap: mapUrl }),
    ...(ORG_SAMEAS.length > 0 && { sameAs: ORG_SAMEAS }),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "07:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "07:00",
        closes: "12:00",
      },
    ],
    areaServed: { "@type": "State", name: "Rio Grande do Norte" },
    parentOrganization: { "@id": ORG_ID },
  };
}

// ---------------------------------------------------------------------------
// BreadcrumbList (>= 2 itens recomendado)
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
export type AuthorInput = {
  name: string;
  slug?: string; // -> /autores/{slug}
  jobTitle?: string;
  bio?: string;
  sameAs?: string[];
};

/** Article (lib/articles) estendido com author objeto e dateModified. */
export type ArticleNodeInput = Omit<Article, "author"> & {
  author?: string | AuthorInput;
  modifiedISO?: string;
};

export function articleNode(a: ArticleNodeInput) {
  const url = `${SITE_URL}/artigos/${a.slug}`;

  const authorObj =
    typeof a.author === "object" && a.author !== null
      ? {
          "@type": "Person",
          name: a.author.name,
          ...(a.author.slug && { url: `${SITE_URL}/autores/${a.author.slug}` }),
          ...(a.author.jobTitle && { jobTitle: a.author.jobTitle }),
          ...(a.author.bio && { description: a.author.bio }),
          ...(a.author.sameAs?.length && { sameAs: a.author.sameAs }),
        }
      : typeof a.author === "string" && a.author.trim()
        ? { "@type": "Person", name: a.author }
        : { "@type": "Organization", "@id": ORG_ID, name: ORG_NAME };

  return {
    "@type": "BlogPosting", // BlogPosting > Article para blog de marca
    "@id": `${url}#article`,
    headline: a.title.slice(0, 110), // Google ignora headline > ~110 chars
    description: a.excerpt,
    image: abs(a.image),
    datePublished: a.isoDate,
    dateModified: a.modifiedISO ?? a.isoDate,
    author: authorObj,
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: a.category,
    inLanguage: "pt-BR",
    ...(a.keywords?.length && { keywords: a.keywords.join(", ") }),
  };
}

// ---------------------------------------------------------------------------
// FAQPage — recebe ARRAY dedicado (decisão do doc 00: faq é campo estruturado
// e renderizado, NÃO blocos). null se < 2. Sem rich snippet (FAQ desligado
// mai/2026), mas forte para AI Overviews.
// ---------------------------------------------------------------------------
export function faqNode(faq: { question: string; answer: string }[] | null | undefined) {
  if (!faq || faq.length < 2) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// ---------------------------------------------------------------------------
// HowTo — recebe objeto dedicado {name, steps}. null se < 2 passos.
// ---------------------------------------------------------------------------
export function howToNode(
  howto: { name: string; steps: { name: string; text: string }[] } | null | undefined,
) {
  if (!howto || !howto.steps || howto.steps.length < 2) return null;
  return {
    "@type": "HowTo",
    name: howto.name,
    step: howto.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

// ---------------------------------------------------------------------------
// CollectionPage + ItemList (pillar/cluster, índice de artigos, catálogo)
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
// Product + Offer (página de produto) — maior ganho ainda não explorado.
// SEM aggregateRating (só com avaliações REAIS aprovadas; inventar viola
// sd-policies do Google).
// ---------------------------------------------------------------------------
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
    ...(images.length > 0 && { image: images }),
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
      seller: { "@id": STORE_ID },
    },
  };
}

// ---------------------------------------------------------------------------
// Service (landing B2B/local — Fase 2). provider @id STORE_ID.
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
    areaServed: {
      "@type": "State",
      name: args.areaServed ?? "Rio Grande do Norte",
    },
    serviceType:
      "Fornecimento de ferramentas, máquinas, equipamentos e EPI para empresas",
  };
}
