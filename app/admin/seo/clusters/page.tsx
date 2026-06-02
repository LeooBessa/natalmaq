import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ClustersManager, type Cluster, type ArtigoOpcao } from "./ClustersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clusters" };

type FaqRow = { pergunta?: string; resposta?: string; question?: string; answer?: string };

// Mapeia faq do banco ([{pergunta,resposta}]) -> {question,answer}[] (editor).
function toFaq(raw: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = it as FaqRow;
      const question = String(o?.pergunta ?? o?.question ?? "").trim();
      const answer = String(o?.resposta ?? o?.answer ?? "").trim();
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((x): x is { question: string; answer: string } => x !== null);
}

export default async function ClustersPage() {
  const sb = await createSupabaseServerClient();

  // Toda leitura de tabela nova (0019) em try/catch: lista vazia se ausente,
  // o painel não pode crashar antes da migration.
  let clusters: Cluster[] = [];
  let artigos: ArtigoOpcao[] = [];

  try {
    const { data, error } = await sb
      .from("clusters")
      .select(
        "id, slug, titulo, subtitulo, intro, meta_title, meta_description, artigo_pilar_id, ordem, status, faq",
      )
      .order("ordem", { ascending: true })
      .order("titulo", { ascending: true });
    if (error) throw error;
    clusters = ((data ?? []) as unknown as RawCluster[]).map((c) => ({
      id: c.id,
      slug: c.slug,
      titulo: c.titulo,
      subtitulo: c.subtitulo ?? "",
      intro: c.intro ?? "",
      meta_title: c.meta_title ?? "",
      meta_description: c.meta_description ?? "",
      artigo_pilar_id: c.artigo_pilar_id ?? "",
      ordem: c.ordem ?? 0,
      status: (c.status as Cluster["status"]) ?? "rascunho",
      faq: toFaq(c.faq),
    }));
  } catch {
    clusters = [];
  }

  try {
    const { data, error } = await sb
      .from("artigos")
      .select("id, titulo, slug, cluster_id, eh_pilar")
      .order("titulo", { ascending: true });
    if (error) throw error;
    artigos = ((data ?? []) as unknown as RawArtigo[]).map((a) => ({
      id: a.id,
      titulo: a.titulo,
      slug: a.slug,
      cluster_id: a.cluster_id ?? null,
      eh_pilar: !!a.eh_pilar,
    }));
  } catch {
    artigos = [];
  }

  // Contagem de artigos por cluster (para a coluna "nº artigos").
  const contagem: Record<string, number> = {};
  for (const a of artigos) {
    if (a.cluster_id) contagem[a.cluster_id] = (contagem[a.cluster_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Clusters</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Guias-pilar que agrupam artigos satélite. Cada cluster vira uma página em{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">/guias/[slug]</code>.
        </p>
      </div>

      <ClustersManager
        clusters={clusters}
        artigos={artigos}
        contagem={contagem}
      />
    </div>
  );
}

type RawCluster = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  intro: string | null;
  meta_title: string | null;
  meta_description: string | null;
  artigo_pilar_id: string | null;
  ordem: number | null;
  status: string | null;
  faq: unknown;
};

type RawArtigo = {
  id: string;
  titulo: string;
  slug: string;
  cluster_id: string | null;
  eh_pilar: boolean | null;
};
