import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreArtigo } from "@/lib/seo/score";
import type { ArticleBlock } from "@/lib/articles";
import { createArtigoAction } from "./actions";

// REGRA DE BUILD: as migrations 0019/0020 podem NÃO estar aplicadas. A leitura da
// tabela `artigos` é try/catch e cai em lista vazia se a tabela não existir — o
// painel não pode crashar antes da migration.
export const dynamic = "force-dynamic";
export const metadata = { title: "Artigos · SEO" };

type SearchParams = Promise<{
  q?: string;
  cluster?: string;
  status?: string;
  page?: string;
}>;
const PAGE_SIZE = 30;

type ArtigoRow = {
  id: string;
  slug: string;
  titulo: string;
  excerpt: string | null;
  imagem: string | null;
  corpo: unknown;
  keywords: string[] | null;
  meta_description: string | null;
  eh_pilar: boolean;
  status: "rascunho" | "publicado" | "arquivado";
  updated_at: string | null;
  cluster_id: string | null;
  cluster: { titulo: string; slug: string } | null;
};

type ClusterOpt = { id: string; titulo: string; slug: string };

function toBlocks(corpo: unknown): ArticleBlock[] {
  return Array.isArray(corpo) ? (corpo as ArticleBlock[]) : [];
}

const STATUS_BADGE: Record<ArtigoRow["status"], { label: string; cls: string }> =
  {
    publicado: { label: "publicado", cls: "bg-green-100 text-green-700" },
    rascunho: { label: "rascunho", cls: "bg-zinc-200 text-zinc-700" },
    arquivado: { label: "arquivado", cls: "bg-amber-100 text-amber-700" },
  };

function scoreBadgeCls(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

async function carregar(sp: {
  q?: string;
  cluster?: string;
  status?: string;
  page: number;
}): Promise<{ artigos: ArtigoRow[]; total: number; clusters: ClusterOpt[] }> {
  try {
    const sb = await createSupabaseServerClient();
    const start = (sp.page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    let query = sb
      .from("artigos")
      .select(
        // cluster:clusters!artigos_cluster_id_fkey: qualifica o FK porque artigos
        // tem 2 relações com clusters (cluster_id e clusters.artigo_pilar_id);
        // sem isso o embed fica ambíguo e a query falha (zerava a lista).
        "id, slug, titulo, excerpt, imagem, corpo, keywords, meta_description, eh_pilar, status, updated_at, cluster_id, cluster:clusters!artigos_cluster_id_fkey(titulo, slug)",
        { count: "exact" },
      );

    if (sp.q) query = query.ilike("titulo", `%${sp.q}%`);
    if (sp.status) query = query.eq("status", sp.status);
    if (sp.cluster) query = query.eq("cluster_id", sp.cluster);

    const { data, count, error } = await query
      .order("updated_at", { ascending: false })
      .range(start, end);

    if (error) return { artigos: [], total: 0, clusters: [] };

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

    return {
      artigos: (data ?? []) as unknown as ArtigoRow[],
      total: count ?? 0,
      clusters,
    };
  } catch {
    return { artigos: [], total: 0, clusters: [] };
  }
}

export default async function ArtigosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { artigos, total, clusters } = await carregar({
    q: sp.q,
    cluster: sp.cluster,
    status: sp.status,
    page,
  });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Artigos</h1>
          <p className="text-sm text-zinc-500">{total} no total</p>
        </div>
        <form action={createArtigoAction}>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Novo artigo
          </button>
        </form>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Buscar
          </label>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Título do artigo"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Cluster
          </label>
          <select
            name="cluster"
            defaultValue={sp.cluster ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Status
          </label>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="rascunho">Rascunho</option>
            <option value="publicado">Publicado</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-2">Título</th>
              <th className="px-5 py-2">Cluster</th>
              <th className="px-5 py-2">Pilar</th>
              <th className="px-5 py-2 text-center">Score</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">Atualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {artigos.map((a) => {
              const { score } = scoreArtigo({
                titulo: a.titulo ?? "",
                excerpt: a.meta_description ?? a.excerpt ?? "",
                keywords: a.keywords ?? [],
                conteudo: toBlocks(a.corpo),
                slug: a.slug ?? "",
              });
              const badge = STATUS_BADGE[a.status];
              return (
                <tr key={a.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2">
                    <Link
                      href={`/admin/seo/artigos/${a.id}` as never}
                      className="font-medium text-zinc-900 hover:text-brand-600"
                    >
                      {a.titulo || "(sem título)"}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-zinc-500">
                    {a.cluster?.titulo ?? "—"}
                  </td>
                  <td className="px-5 py-2">
                    {a.eh_pilar ? (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        pilar
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-center">
                    <span
                      className={`inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${scoreBadgeCls(score)}`}
                    >
                      {score}
                    </span>
                  </td>
                  <td className="px-5 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-zinc-500">
                    {fmtDate(a.updated_at)}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <Link
                      href={`/admin/seo/artigos/${a.id}` as never}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Editar →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {artigos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                  Nenhum artigo encontrado. Clique em “+ Novo artigo” para criar
                  um rascunho.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="text-sm text-zinc-500">
          Página {page} de {totalPages}{" "}
          {page > 1 && (
            <Link
              href={
                `/admin/seo/artigos?q=${sp.q ?? ""}&cluster=${sp.cluster ?? ""}&status=${sp.status ?? ""}&page=${page - 1}` as never
              }
              className="ml-3 text-brand-600 hover:underline"
            >
              ← Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={
                `/admin/seo/artigos?q=${sp.q ?? ""}&cluster=${sp.cluster ?? ""}&status=${sp.status ?? ""}&page=${page + 1}` as never
              }
              className="ml-3 text-brand-600 hover:underline"
            >
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
