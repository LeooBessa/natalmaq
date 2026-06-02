import type { MetadataRoute } from "next";

import { articles } from "@/lib/articles";
import { listCategorias, listMarcas } from "@/lib/data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://natalmaq-main.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Páginas estáticas principais
  const estaticas: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalogo`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/artigos`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/institucional`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Artigos (fonte: lib/articles.ts)
  const artigos: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/artigos/${a.slug}`,
    lastModified: new Date(a.isoDate),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  // Marcas e categorias (best-effort — não quebra o sitemap se o Supabase falhar)
  let dinamicas: MetadataRoute.Sitemap = [];
  try {
    const [marcas, categorias] = await Promise.all([listMarcas(), listCategorias()]);
    dinamicas = [
      ...marcas.map((m) => ({
        url: `${SITE_URL}/marca/${m.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
      ...categorias.map((c) => ({
        url: `${SITE_URL}/catalogo?categoria=${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    dinamicas = [];
  }

  return [...estaticas, ...artigos, ...dinamicas];
}
