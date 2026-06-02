import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ArticleBlock } from "@/lib/articles";
import type { PickerProduto } from "@/app/admin/seo/_components/ProdutoPicker";
import { ArtigoEditor, type ArtigoEditorData } from "./ArtigoEditor";

// REGRA DE BUILD: as migrations 0019/0020 podem NÃO estar aplicadas. A leitura é
// try/catch; se a tabela `artigos` não existir, mostramos 404 (não crasha).
export const dynamic = "force-dynamic";
export const metadata = { title: "Editar artigo · SEO" };

type ClusterOpt = { id: string; titulo: string; slug: string };

function toBlocks(corpo: unknown): ArticleBlock[] {
  return Array.isArray(corpo) ? (corpo as ArticleBlock[]) : [];
}

/** faq do banco ([{pergunta,resposta}] | [{question,answer}]) -> {question,answer}[]. */
function toFaq(raw: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = it as Record<string, unknown>;
      const question = (o?.question ?? o?.pergunta) as string | undefined;
      const answer = (o?.answer ?? o?.resposta) as string | undefined;
      return question != null || answer != null
        ? { question: String(question ?? ""), answer: String(answer ?? "") }
        : null;
    })
    .filter((x): x is { question: string; answer: string } => x !== null);
}

/** howto do banco ({nome,passos} | {name,steps}) -> {name, steps:{name,text}[]} | null. */
function toHowto(
  raw: unknown,
): { name: string; steps: { name: string; text: string }[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = String((o.name ?? o.nome ?? "") as string);
  const passos = (o.steps ?? o.passos) as unknown;
  if (!Array.isArray(passos)) return null;
  const steps = passos.map((p) => {
    const s = p as Record<string, unknown>;
    return {
      name: String((s?.name ?? s?.nome ?? "") as string),
      text: String((s?.text ?? s?.texto ?? "") as string),
    };
  });
  return { name, steps };
}

async function carregar(id: string): Promise<{
  artigo: ArtigoEditorData | null;
  clusters: ClusterOpt[];
  produtos: PickerProduto[];
}> {
  try {
    const sb = await createSupabaseServerClient();

    const { data, error } = await sb
      .from("artigos")
      .select(
        "id, slug, titulo, categoria_label, excerpt, imagem, corpo, cluster_id, eh_pilar, meta_title, meta_description, keywords, status, published_at, autor_nome, reading_time, faq, howto, cluster:clusters!artigos_cluster_id_fkey(slug)",
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return { artigo: null, clusters: [], produtos: [] };
    }

    const row = data as Record<string, unknown>;
    const publishedAt = row.published_at as string | null;

    const artigo: ArtigoEditorData = {
      id: String(row.id),
      slug: String(row.slug ?? ""),
      titulo: String(row.titulo ?? ""),
      categoria_label: (row.categoria_label as string) ?? "",
      excerpt: String(row.excerpt ?? ""),
      imagem: (row.imagem as string) ?? "",
      corpo: toBlocks(row.corpo),
      cluster_id: (row.cluster_id as string) ?? "",
      cluster_slug:
        (row.cluster as { slug?: string } | null)?.slug ?? undefined,
      eh_pilar: row.eh_pilar === true,
      meta_title: (row.meta_title as string) ?? "",
      meta_description: (row.meta_description as string) ?? "",
      keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
      status:
        (row.status as ArtigoEditorData["status"]) ?? "rascunho",
      // input date espera "YYYY-MM-DD"
      published_at: publishedAt ? publishedAt.slice(0, 10) : "",
      autor_nome: (row.autor_nome as string) ?? "",
      reading_time:
        typeof row.reading_time === "number" ? (row.reading_time as number) : 0,
      faq: toFaq(row.faq),
      howto: toHowto(row.howto),
    };

    // Clusters (select). Best-effort.
    let clusters: ClusterOpt[] = [];
    try {
      const { data: cl } = await sb
        .from("clusters")
        .select("id, titulo, slug")
        .order("titulo");
      clusters = (cl ?? []) as ClusterOpt[];
    } catch {
      clusters = [];
    }

    // Produtos (para resolver/exibir sugestões de links e pickers). Best-effort.
    let produtos: PickerProduto[] = [];
    try {
      const { data: pr } = await sb
        .from("produtos")
        .select("id, nome, codigo, imagens")
        .eq("ativo", true)
        .order("nome")
        .limit(500);
      produtos = ((pr ?? []) as Array<{
        id: string;
        nome: string;
        codigo: string | null;
        imagens: string[] | null;
      }>).map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        imagem: p.imagens?.[0] ?? null,
      }));
    } catch {
      produtos = [];
    }

    return { artigo, clusters, produtos };
  } catch {
    return { artigo: null, clusters: [], produtos: [] };
  }
}

export default async function EditarArtigoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { artigo, clusters, produtos } = await carregar(id);

  if (!artigo) notFound();

  return (
    <ArtigoEditor artigo={artigo} clusters={clusters} produtos={produtos} />
  );
}
