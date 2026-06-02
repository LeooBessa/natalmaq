import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Listagem RSC das Landing pages (molde: app/admin/produtos/page.tsx).
// force-dynamic + leitura em try/catch: se a tabela landing_pages ainda não
// existir (migration 0019 não aplicada), a lista vem vazia e o painel não quebra.

export const dynamic = "force-dynamic";
export const metadata = { title: "Landing pages" };

type SearchParams = Promise<{ q?: string; page?: string }>;
const PAGE_SIZE = 30;

type LandingRow = {
  id: string;
  slug: string;
  titulo: string;
  cidade: string | null;
  uf: string | null;
  publico: string | null;
  status: string;
  ordem: number | null;
  updated_at: string | null;
};

async function carregarLandings(
  q: string | undefined,
  start: number,
  end: number,
): Promise<{ rows: LandingRow[]; total: number }> {
  try {
    const sb = await createSupabaseServerClient();
    let query = sb
      .from("landing_pages")
      .select("id, slug, titulo, cidade, uf, publico, status, ordem, updated_at", {
        count: "exact",
      });
    if (q) query = query.or(`titulo.ilike.%${q}%,slug.ilike.%${q}%`);

    const { data, count, error } = await query
      .order("ordem")
      .order("updated_at", { ascending: false })
      .range(start, end);

    if (error) return { rows: [], total: 0 };
    return { rows: (data ?? []) as unknown as LandingRow[], total: count ?? 0 };
  } catch {
    return { rows: [], total: 0 };
  }
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  publicado: { cls: "bg-green-100 text-green-700", label: "publicado" },
  rascunho: { cls: "bg-zinc-200 text-zinc-700", label: "rascunho" },
  arquivado: { cls: "bg-amber-100 text-amber-700", label: "arquivado" },
};

export default async function LandingPagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const { rows, total } = await carregarLandings(sp.q, start, end);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Landing pages</h1>
          <p className="text-sm text-zinc-500">{total} no total</p>
        </div>
        <Link
          href="/admin/seo/landing/novo"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Nova landing page
        </Link>
      </div>

      <form className="flex items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Buscar
          </label>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Título ou slug"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
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
              <th className="px-5 py-2">Slug</th>
              <th className="px-5 py-2">Cidade/UF</th>
              <th className="px-5 py-2">Público</th>
              <th className="px-5 py-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const badge = STATUS_BADGE[l.status] ?? STATUS_BADGE.rascunho;
              const local = [l.cidade, l.uf].filter(Boolean).join("/");
              return (
                <tr key={l.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2">
                    <Link
                      href={`/admin/seo/landing/${l.id}`}
                      className="font-medium hover:text-brand-600"
                    >
                      {l.titulo || "(sem título)"}
                    </Link>
                  </td>
                  <td className="px-5 py-2 font-mono text-xs text-zinc-500">
                    {l.slug}
                  </td>
                  <td className="px-5 py-2 text-zinc-500">{local || "—"}</td>
                  <td className="px-5 py-2 text-zinc-500">{l.publico ?? "—"}</td>
                  <td className="px-5 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right">
                    <Link
                      href={`/admin/seo/landing/${l.id}`}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Editar →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                  Nenhuma landing page cadastrada.
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
              href={`/admin/seo/landing?q=${sp.q ?? ""}&page=${page - 1}`}
              className="ml-3 text-brand-600 hover:underline"
            >
              ← Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/admin/seo/landing?q=${sp.q ?? ""}&page=${page + 1}`}
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
