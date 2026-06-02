import "server-only";

import { createClient } from "@supabase/supabase-js";

import { articles, getArticle, type Article, type ArticleBlock } from "@/lib/articles";
import type { Cluster, LandingPage } from "@/lib/seo/types";

// Leitura de conteúdo SEO (artigos / clusters / landing_pages) do Supabase, com
// FALLBACK determinístico ao array de lib/articles.ts.
//
// REGRA CRÍTICA: a migration 0019 NÃO estará aplicada no Supabase quando o build
// rodar. TODA leitura das tabelas novas é try/catch e NUNCA lança para fora —
// em erro/ausência cai no fallback. O site precisa buildar e funcionar idêntico
// ao de hoje mesmo sem a migration. Espelha o padrão de lib/data.ts (anon key).

function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

// --- Helpers de mapeamento -------------------------------------------------

/** Formata uma data ISO/timestamp em pt-BR (ex: "26 de maio de 2026"). */
function formatDatePtBR(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Extrai YYYY-MM-DD de um timestamp (ex: "2026-05-26"). */
function isoDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Garante que o corpo (jsonb) seja um ArticleBlock[] válido. */
function toBlocks(corpo: unknown): ArticleBlock[] {
  return Array.isArray(corpo) ? (corpo as ArticleBlock[]) : [];
}

/** Mapeia faq do banco ([{pergunta,resposta}]) -> {question,answer}[]. */
function toFaq(
  raw: unknown,
): { question: string; answer: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map((it) => {
      const o = it as Record<string, unknown>;
      const question = (o?.pergunta ?? o?.question) as string | undefined;
      const answer = (o?.resposta ?? o?.answer) as string | undefined;
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((x): x is { question: string; answer: string } => x !== null);
  return out.length ? out : undefined;
}

/** Mapeia howto do banco ({nome, passos:[{nome,texto}]}) -> {name, steps}. */
function toHowto(
  raw: unknown,
): { name: string; steps: { name: string; text: string }[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = (o.nome ?? o.name) as string | undefined;
  const passos = (o.passos ?? o.steps) as unknown;
  if (!name || !Array.isArray(passos)) return null;
  const steps = passos
    .map((p) => {
      const s = p as Record<string, unknown>;
      const stepName = (s?.nome ?? s?.name) as string | undefined;
      const stepText = (s?.texto ?? s?.text) as string | undefined;
      if (!stepName || !stepText) return null;
      return { name: stepName, text: stepText };
    })
    .filter((x): x is { name: string; text: string } => x !== null);
  return steps.length ? { name, steps } : null;
}

/** Mapeia uma row da tabela `artigos` -> Article (tipo do app). */
function rowToArticle(row: Record<string, unknown>): Article {
  return {
    slug: String(row.slug ?? ""),
    category: (row.categoria_label as string) ?? "",
    title: String(row.titulo ?? ""),
    excerpt: String(row.excerpt ?? ""),
    image: (row.imagem as string) ?? "",
    date: formatDatePtBR(row.published_at as string),
    isoDate: isoDateOnly(row.published_at as string),
    readingTime: row.reading_time
      ? `${row.reading_time} min de leitura`
      : "",
    keywords: Array.isArray(row.keywords)
      ? (row.keywords as string[])
      : undefined,
    author: (row.autor_nome as string) ?? undefined,
    content: toBlocks(row.corpo),
    faq: toFaq(row.faq),
    howto: toHowto(row.howto),
    cluster:
      typeof row.cluster_slug === "string"
        ? (row.cluster_slug as string)
        : undefined,
  };
}

const ARTIGO_SELECT =
  "slug, titulo, categoria_label, excerpt, imagem, corpo, keywords, reading_time, published_at, autor_nome, faq, howto, cluster_id";

// --- Artigos ---------------------------------------------------------------

/**
 * Lê um artigo publicado pelo slug. FALLBACK: getArticle(slug) do array.
 * Nunca lança.
 */
export async function getArtigo(slug: string): Promise<Article | null> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("artigos")
      .select(ARTIGO_SELECT)
      .eq("slug", slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error || !data) {
      return getArticle(slug) ?? null;
    }
    return rowToArticle(data as Record<string, unknown>);
  } catch {
    return getArticle(slug) ?? null;
  }
}

/**
 * Lista artigos publicados (mais recentes primeiro). FALLBACK: array `articles`.
 * Se a query voltar vazia (tabela existe mas sem dados), também cai no array
 * para não esvaziar o site antes do seed. Nunca lança.
 */
export async function listArtigos(): Promise<Article[]> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("artigos")
      .select(ARTIGO_SELECT)
      .eq("status", "publicado")
      .order("published_at", { ascending: false });
    if (error || !data || data.length === 0) {
      return articles;
    }
    return (data as Record<string, unknown>[]).map(rowToArticle);
  } catch {
    return articles;
  }
}

/**
 * Lista os artigos satélite de um cluster pelo SLUG do cluster (mais recentes
 * primeiro). Resolve o cluster -> id e filtra `artigos.cluster_id`.
 * Best-effort: em erro/ausência da migration, faz fallback ao array `articles`
 * filtrando pelo campo `cluster` (slug). Nunca lança.
 */
export async function listArtigosByCluster(
  clusterSlug: string,
): Promise<Article[]> {
  try {
    const sb = getServerSupabase();
    const cluster = await sb
      .from("clusters")
      .select("id")
      .eq("slug", clusterSlug)
      .maybeSingle();
    if (cluster.error || !cluster.data?.id) {
      return articles.filter((a) => a.cluster === clusterSlug);
    }
    const { data, error } = await sb
      .from("artigos")
      .select(ARTIGO_SELECT)
      .eq("status", "publicado")
      .eq("cluster_id", cluster.data.id)
      .order("published_at", { ascending: false });
    if (error || !data) {
      return articles.filter((a) => a.cluster === clusterSlug);
    }
    return (data as Record<string, unknown>[]).map(rowToArticle);
  } catch {
    return articles.filter((a) => a.cluster === clusterSlug);
  }
}

// --- Clusters (render é Fase 2; funções prontas, best-effort) ---------------

function rowToCluster(row: Record<string, unknown>): Cluster {
  return {
    slug: String(row.slug ?? ""),
    title: String(row.titulo ?? ""),
    subtitle: (row.subtitulo as string) ?? null,
    intro: (row.intro as string) ?? null,
    metaTitle: (row.meta_title as string) ?? null,
    metaDescription: (row.meta_description as string) ?? null,
    faq: toFaq(row.faq),
    noindex: row.noindex === true,
    ordem: typeof row.ordem === "number" ? (row.ordem as number) : undefined,
  };
}

const CLUSTER_SELECT =
  "slug, titulo, subtitulo, intro, meta_title, meta_description, faq, noindex, ordem";

/** Lê um cluster publicado pelo slug. Best-effort: null em erro/ausência. */
export async function getCluster(slug: string): Promise<Cluster | null> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("clusters")
      .select(CLUSTER_SELECT)
      .eq("slug", slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error || !data) return null;
    return rowToCluster(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Lista clusters publicados (por ordem). Best-effort: [] em erro/ausência. */
export async function listClusters(): Promise<Cluster[]> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("clusters")
      .select(CLUSTER_SELECT)
      .eq("status", "publicado")
      .order("ordem", { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToCluster);
  } catch {
    return [];
  }
}

// --- Landing pages (render é Fase 2; funções prontas, best-effort) ----------

function rowToLanding(row: Record<string, unknown>): LandingPage {
  return {
    slug: String(row.slug ?? ""),
    title: String(row.titulo ?? ""),
    subtitle: (row.subtitulo as string) ?? null,
    cidade: (row.cidade as string) ?? null,
    uf: (row.uf as string) ?? null,
    publico: (row.publico as string) ?? null,
    heroImage: (row.hero_imagem as string) ?? null,
    content: toBlocks(row.corpo),
    faq: toFaq(row.faq),
    produtosDestaque: Array.isArray(row.produtos_destaque)
      ? (row.produtos_destaque as string[])
      : undefined,
    noindex: row.noindex === true,
    metaTitle: (row.meta_title as string) ?? null,
    metaDescription: (row.meta_description as string) ?? null,
    ordem: typeof row.ordem === "number" ? (row.ordem as number) : undefined,
  };
}

const LANDING_SELECT =
  "slug, titulo, subtitulo, cidade, uf, publico, hero_imagem, corpo, faq, produtos_destaque, noindex, meta_title, meta_description, ordem";

/** Lê uma landing publicada pelo slug. Best-effort: null em erro/ausência. */
export async function getLanding(slug: string): Promise<LandingPage | null> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("landing_pages")
      .select(LANDING_SELECT)
      .eq("slug", slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error || !data) return null;
    return rowToLanding(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Lista landings publicadas (por ordem). Best-effort: [] em erro/ausência. */
export async function listLandings(): Promise<LandingPage[]> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("landing_pages")
      .select(LANDING_SELECT)
      .eq("status", "publicado")
      .order("ordem", { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToLanding);
  } catch {
    return [];
  }
}
