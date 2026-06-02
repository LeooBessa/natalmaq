import type { MetadataRoute } from "next";

import { listArtigos, listClusters, listLandings } from "@/lib/conteudo";
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

  // Artigos (fonte: Supabase com fallback a lib/articles.ts)
  const listaArtigos = await listArtigos();
  const artigos: MetadataRoute.Sitemap = listaArtigos.map((a) => {
    // isoDate pode vir vazio (row sem published_at): evita Invalid Date no XML.
    const d = a.isoDate ? new Date(a.isoDate) : now;
    return {
      url: `${SITE_URL}/artigos/${a.slug}`,
      lastModified: Number.isNaN(d.getTime()) ? now : d,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    };
  });

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

  // Clusters (guias) e landings (soluções) — só existem após a migration 0019.
  // Best-effort: listas vazias (sem migration) não adicionam NADA, nem o índice.
  // Quando houver conteúdo, adiciona o índice /guias|/solucoes + cada slug.
  let conteudoSeo: MetadataRoute.Sitemap = [];
  try {
    const [clusters, landings] = await Promise.all([
      listClusters(),
      listLandings(),
    ]);

    if (clusters.length > 0) {
      conteudoSeo.push({
        url: `${SITE_URL}/guias`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
      for (const c of clusters) {
        conteudoSeo.push({
          url: `${SITE_URL}/guias/${c.slug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
      }
    }

    if (landings.length > 0) {
      conteudoSeo.push({
        url: `${SITE_URL}/solucoes`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
      for (const l of landings) {
        conteudoSeo.push({
          url: `${SITE_URL}/solucoes/${l.slug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
      }
    }
  } catch {
    conteudoSeo = [];
  }

  return [...estaticas, ...artigos, ...dinamicas, ...conteudoSeo];
}
