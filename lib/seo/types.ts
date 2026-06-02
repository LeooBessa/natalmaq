// Tipos de SEO (Fase 1). Cluster / LandingPage espelham as colunas da migration
// 0019 (doc 01 §clusters/landing_pages), em camelCase no app onde útil.
// Article/ArticleBlock são re-exportados de lib/articles para que o agente de
// páginas importe tudo de um lugar só.

import type { Article, ArticleBlock } from "@/lib/articles";

export type { Article, ArticleBlock };

/** Item de FAQ estruturado (renderizado + JSON-LD FAQPage). */
export type FaqItem = { question: string; answer: string };

/** HowTo estruturado (renderizado + JSON-LD HowTo). */
export type HowTo = { name: string; steps: { name: string; text: string }[] };

/** Autor (E-E-A-T). Espelha a tabela `autores` quando existir; também usado
 *  como objeto `author` nos nós de Article. */
export type Autor = {
  slug: string;
  name: string;
  jobTitle?: string;
  bio?: string;
  photo?: string;
  sameAs?: string[];
};

/**
 * Cluster / tópico-pilar -> página /guias/[slug].
 * Espelha `clusters` (doc 01). camelCase no app.
 */
export type Cluster = {
  slug: string;
  title: string;            // clusters.titulo
  subtitle?: string | null; // clusters.subtitulo
  intro?: string | null;    // clusters.intro
  metaTitle?: string | null;
  metaDescription?: string | null;
  faq?: FaqItem[];
  noindex?: boolean;        // clusters.noindex
  ordem?: number;
};

/**
 * Landing page B2B / local -> página /solucoes/[slug].
 * Espelha `landing_pages` (doc 01). camelCase no app.
 */
export type LandingPage = {
  slug: string;
  title: string;            // landing_pages.titulo
  subtitle?: string | null; // landing_pages.subtitulo
  cidade?: string | null;
  uf?: string | null;
  publico?: string | null;
  heroImage?: string | null; // landing_pages.hero_imagem
  content: ArticleBlock[];   // landing_pages.corpo
  faq?: FaqItem[];
  /** landing_pages.produtos_destaque — ids (uuid) de produtos da vitrine. */
  produtosDestaque?: string[];
  noindex?: boolean;        // landing_pages.noindex
  metaTitle?: string | null;
  metaDescription?: string | null;
  ordem?: number;
};
