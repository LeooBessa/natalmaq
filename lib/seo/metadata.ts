// Geração determinística de Metadata (Next 15) — doc 02 §4.2.
// Regras de comprimento (heurística; Google trunca ~525-535px desktop):
//   - title <= 60 chars (o sufixo " | Natalmaq" é aplicado pelo TEMPLATE do
//     layout: NÃO duplicar aqui)
//   - description 110-160 chars (alvo); truncamos no limite sem cortar palavra
// O canonical sai por `alternates.canonical` (relativo; metadataBase resolve).

import type { Metadata } from "next";

import { ORG_NAME } from "./constants";

const TITLE_MAX = 60;
const DESC_MAX = 160;
const DESC_MIN = 110;

/** Corta uma string num limite sem partir palavra ao meio. */
export function cutAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * Garante title <= 60 chars. Por padrão NÃO aplica o sufixo " | Natalmaq"
 * (o template do layout já faz isso). Passe `withSuffix=true` apenas se for
 * usar fora do template.
 */
export function clampTitle(raw: string, withSuffix = false): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  const suffix = withSuffix ? ` | ${ORG_NAME}` : "";
  const budget = TITLE_MAX - suffix.length;
  const base = clean.length <= budget ? clean : cutAtWord(clean, budget);
  return `${base}${suffix}`;
}

/** Normaliza/trunca a description para <= 160 chars sem cortar palavra. */
export function clampDescription(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length <= DESC_MAX ? clean : cutAtWord(clean, DESC_MAX - 1) + "…";
}

export type BuildMetadataArgs = {
  /** Sem o " | Natalmaq" — o template "%s | Natalmaq" do layout aplica o sufixo. */
  title: string;
  description: string;
  /** Path relativo, ex "/artigos/slug" (metadataBase = SITE_URL resolve). */
  path: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string; // ISO
  modifiedTime?: string; // ISO
  authorName?: string;
  keywords?: string[];
  /** noindex p/ rascunho / página sem valor de indexação. */
  noindex?: boolean;
};

export function buildMetadata(a: BuildMetadataArgs): Metadata {
  const title = clampTitle(a.title);
  const description = clampDescription(a.description);
  const images = a.image ? [{ url: a.image }] : undefined;

  return {
    title,
    description,
    keywords: a.keywords,
    alternates: { canonical: a.path },
    robots: a.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
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
      title,
      description,
      images: a.image ? [a.image] : undefined,
    },
  };
}

// Re-exporta limites para o admin (score/preview) reusar a mesma heurística.
export const SEO_LIMITS = { TITLE_MAX, DESC_MAX, DESC_MIN } as const;
