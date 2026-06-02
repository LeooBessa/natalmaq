"use server";

// Server actions da área de ARTIGOS do admin de SEO (Fase 3).
// Padrão copiado 1:1 de app/admin/produtos/actions.ts:
//   - "use server" + createSupabaseServerClient (cliente AUTENTICADO via cookies;
//     RLS is_admin aplica -> vê rascunhos).
//   - parseForm(FormData), retorno { error } | { ok: true }, revalidatePath(...),
//     create/delete usa redirect().
//
// REGRA DE BUILD: as migrations 0019/0020/0021 NÃO estão aplicadas no build.
// As actions de save retornam erro amigável se a tabela faltar (Supabase devolve
// { error }, que repassamos). A geração de links (persistLinks) é best-effort e
// NUNCA bloqueia o save (try/catch). sugerirLinksAction cai em [] em erro.

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/app/admin/seo/_lib/slug";
import { readingTimeMin } from "@/app/admin/seo/_lib/reading-time";
import {
  buildDictionary,
  buildInternalLinks,
  buildInternalLinksFull,
  type ArticleInput,
} from "@/lib/seo/internal-links";
import { persistLinks, type SupabaseLike } from "@/lib/seo/persist";
import type { ArticleBlock } from "@/lib/articles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/** Parse seguro de JSON com fallback. Nunca lança. */
function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** keywords: 1 por linha OU separadas por vírgula. */
function parseKeywords(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normaliza blocos vindos do JSON do form para ArticleBlock[] válido. */
function parseBlocks(raw: FormDataEntryValue | null): ArticleBlock[] {
  const arr = parseJson<unknown[]>(raw, []);
  if (!Array.isArray(arr)) return [];
  const out: ArticleBlock[] = [];
  for (const b of arr) {
    const o = b as Record<string, unknown>;
    if (o?.type === "heading" || o?.type === "paragraph") {
      out.push({ type: o.type, text: String(o.text ?? "") });
    } else if (o?.type === "list" && Array.isArray(o.items)) {
      out.push({
        type: "list",
        items: (o.items as unknown[]).map((x) => String(x ?? "")),
      });
    }
  }
  return out;
}

type ArtigoUpdate = {
  titulo: string;
  slug: string;
  categoria_label: string | null;
  excerpt: string;
  imagem: string | null;
  corpo: ArticleBlock[];
  cluster_id: string | null;
  eh_pilar: boolean;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[];
  autor_nome: string | null;
  status: "rascunho" | "publicado" | "arquivado";
  published_at: string | null;
  reading_time: number;
  faq: { question: string; answer: string }[];
  howto: { name: string; steps: { name: string; text: string }[] } | null;
};

function parseForm(formData: FormData): ArtigoUpdate {
  const titulo = str(formData.get("titulo"));
  const slugRaw = str(formData.get("slug"));
  const corpo = parseBlocks(formData.get("corpo"));

  const statusRaw = str(formData.get("status"));
  const status: ArtigoUpdate["status"] =
    statusRaw === "publicado" || statusRaw === "arquivado"
      ? statusRaw
      : "rascunho";

  const publishedRaw = str(formData.get("published_at"));

  return {
    titulo,
    // slug derivado do título quando vazio (mesmo fallback do produto).
    slug: (slugRaw ? slugify(slugRaw) : "") || slugify(titulo),
    categoria_label: str(formData.get("categoria_label")) || null,
    excerpt: str(formData.get("excerpt")),
    imagem: str(formData.get("imagem")) || null,
    corpo,
    cluster_id: str(formData.get("cluster_id")) || null,
    eh_pilar: formData.get("eh_pilar") === "on",
    meta_title: str(formData.get("meta_title")) || null,
    meta_description: str(formData.get("meta_description")) || null,
    keywords: parseKeywords(formData.get("keywords")),
    autor_nome: str(formData.get("autor_nome")) || null,
    status,
    // published_at: aceita "YYYY-MM-DD" (input date) ou ISO; null limpa.
    published_at: publishedRaw ? new Date(publishedRaw).toISOString() : null,
    reading_time: readingTimeMin(corpo),
    faq: parseJson<{ question: string; answer: string }[]>(
      formData.get("faq"),
      [],
    ),
    howto: parseJson<ArtigoUpdate["howto"]>(formData.get("howto"), null),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Cria um rascunho vazio (slug temporário único) e redireciona ao editor [id].
 * Espelha createProdutoAction: insert + select id + redirect.
 */
export async function createArtigoAction() {
  const sb = await createSupabaseServerClient();
  const slug = `rascunho-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  const { error, data } = await sb
    .from("artigos")
    .insert({
      slug,
      titulo: "Novo artigo",
      excerpt: "",
      corpo: [],
      status: "rascunho",
    })
    .select("id")
    .single();

  if (error || !data) {
    // Tabela ausente / RLS: volta para a listagem (que mostra a lista vazia).
    redirect("/admin/seo/artigos");
  }

  revalidatePath("/admin/seo/artigos");
  redirect(`/admin/seo/artigos/${data!.id}`);
}

/**
 * Salva o artigo. Depois, se !links_locked, roda o motor de linkagem completo e
 * materializa (best-effort, nunca bloqueia o save). useActionState(_prev, fd).
 */
export async function updateArtigoAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const sb = await createSupabaseServerClient();
  const data = parseForm(formData);

  if (!data.titulo) return { error: "O título é obrigatório." };
  if (!data.slug) return { error: "Slug inválido. Defina um título ou slug." };

  // corpo/faq são jsonb array (CHECK na 0019). howto é jsonb nullable.
  const { error } = await sb
    .from("artigos")
    .update({
      titulo: data.titulo,
      slug: data.slug,
      categoria_label: data.categoria_label,
      excerpt: data.excerpt,
      imagem: data.imagem,
      corpo: data.corpo,
      cluster_id: data.cluster_id,
      eh_pilar: data.eh_pilar,
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      keywords: data.keywords,
      autor_nome: data.autor_nome ?? "Equipe Natalmaq",
      status: data.status,
      published_at: data.published_at,
      reading_time: data.reading_time,
      faq: data.faq,
      howto: data.howto,
    })
    .eq("id", id);

  if (error) {
    return {
      error:
        "Não foi possível salvar. A migration de conteúdo (0019/0020) pode não estar aplicada. " +
        error.message,
    };
  }

  // --- Linkagem interna (best-effort, não bloqueia o save) -----------------
  // Resolve o slug do cluster para alimentar o motor (cluster_id -> slug).
  try {
    let locked = false;
    let clusterSlug: string | undefined;
    try {
      const { data: row } = await sb
        .from("artigos")
        .select("links_locked, cluster:clusters(slug)")
        .eq("id", id)
        .maybeSingle();
      const r = row as
        | { links_locked?: boolean; cluster?: { slug?: string } | null }
        | null;
      locked = r?.links_locked === true;
      clusterSlug = r?.cluster?.slug ?? undefined;
    } catch {
      // coluna/relacao ausente -> segue sem trava nem cluster.
    }

    if (!locked) {
      const article: ArticleInput = {
        slug: data.slug,
        titulo: data.titulo,
        keywords: data.keywords,
        cluster: clusterSlug,
        content: data.corpo,
      };
      const result = await buildInternalLinksFull(article);
      // persistLinks aceita o contrato mínimo SupabaseLike (SSR ou admin).
      await persistLinks(sb as unknown as SupabaseLike, id, result);
    }
  } catch {
    // motor/persistência falhou (tabela ausente etc.) -> save segue válido.
  }

  revalidatePath("/admin/seo/artigos");
  revalidatePath(`/admin/seo/artigos/${id}`);
  revalidatePath(`/artigos/${data.slug}`);
  revalidateTag("artigos");
  return { ok: true };
}

/** Atalho de toolbar: muda só o status (rascunho/publicado/arquivado). */
export async function setStatusArtigoAction(
  id: string,
  status: "rascunho" | "publicado" | "arquivado",
): Promise<{ error?: string; ok?: boolean }> {
  const sb = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { status };
  // Ao publicar pela 1ª vez, carimba published_at se ainda não houver.
  if (status === "publicado") {
    try {
      const { data: row } = await sb
        .from("artigos")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      if (!(row as { published_at?: string } | null)?.published_at) {
        patch.published_at = new Date().toISOString();
      }
    } catch {
      // ignora: o update abaixo ainda muda o status.
    }
  }

  const { error } = await sb.from("artigos").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/seo/artigos");
  revalidatePath(`/admin/seo/artigos/${id}`);
  revalidateTag("artigos");
  return { ok: true };
}

/** Apaga o artigo e volta à listagem (mesmo padrão de deleteProdutoAction). */
export async function deleteArtigoAction(id: string) {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("artigos").delete().eq("id", id);
  if (error) {
    // Não há para onde redirecionar com erro amigável aqui; revalida e volta.
    revalidatePath("/admin/seo/artigos");
    return;
  }
  revalidatePath("/admin/seo/artigos");
  revalidateTag("artigos");
  redirect("/admin/seo/artigos");
}

export type LinkSugestaoServer = {
  blockIndex: number;
  anchor: string;
  href: string;
  tipo: "produto" | "categoria" | "marca" | "artigo";
  confianca: number;
  trecho?: string;
};

/**
 * Roda o motor de linkagem (buildDictionary + buildInternalLinks) no servidor e
 * devolve as sugestões inline já mapeadas para o InternalLinksReview. Cluster do
 * tipo "cluster" é ignorado (o review só cobre produto/categoria/marca/artigo).
 * Best-effort: [] em qualquer erro (tabela/dicionário ausente).
 */
export async function sugerirLinksAction(payload: {
  slug: string;
  titulo: string;
  keywords: string[];
  cluster?: string;
  blocks: ArticleBlock[];
}): Promise<LinkSugestaoServer[]> {
  try {
    const dict = await buildDictionary();
    const article: ArticleInput = {
      slug: payload.slug,
      titulo: payload.titulo,
      keywords: payload.keywords ?? [],
      cluster: payload.cluster,
      content: payload.blocks ?? [],
    };
    const { inline } = buildInternalLinks(article, dict);

    return inline
      .filter((l) => l.target.type !== "cluster")
      .map((l) => ({
        blockIndex: l.blockIndex,
        anchor: l.anchor,
        href: l.target.href,
        tipo: l.target.type as LinkSugestaoServer["tipo"],
        // Deriva confiança da prioridade do tipo (0..6) -> 0..100, com piso 40.
        confianca: Math.min(100, 40 + l.target.prioridade * 10),
        trecho: trechoDoBloco(payload.blocks ?? [], l.blockIndex, l.anchor),
      }));
  } catch {
    return [];
  }
}

/** Extrai um trecho curto em volta da âncora para contexto na revisão. */
function trechoDoBloco(
  blocks: ArticleBlock[],
  blockIndex: number,
  anchor: string,
): string | undefined {
  const b = blocks[blockIndex];
  if (!b) return undefined;
  const text =
    b.type === "paragraph"
      ? b.text
      : b.type === "list"
        ? b.items.join(" ")
        : "";
  if (!text) return undefined;
  const i = text.indexOf(anchor);
  if (i < 0) return text.slice(0, 90);
  const start = Math.max(0, i - 35);
  const end = Math.min(text.length, i + anchor.length + 35);
  return text.slice(start, end);
}

/** Upload da imagem de capa para o bucket "conteudo" (5MB). */
export async function uploadCapaAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const { uploadParaBucket } = await import("@/app/admin/_lib/upload");
  return uploadParaBucket("conteudo", formData);
}
