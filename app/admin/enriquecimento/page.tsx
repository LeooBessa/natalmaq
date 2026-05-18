import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RevisaoList, type Candidato } from "./RevisaoList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enriquecimento de fotos" };

type SearchParams = Promise<{ page?: string }>;
const PAGE_SIZE = 24;

export default async function EnriquecimentoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const start = (page - 1) * PAGE_SIZE;

  const sb = await createSupabaseServerClient();

  const [{ data, count }, { count: aprovados }, { count: rejeitados }] = await Promise.all([
    sb
      .from("produto_enriquecimento")
      .select(
        "id, titulo, imagem_url, url_origem, preco_origem, score, produto:produtos(id, codigo, nome, imagens)",
        { count: "exact" },
      )
      .eq("status", "pendente")
      .order("score", { ascending: false })
      .range(start, start + PAGE_SIZE - 1),
    sb
      .from("produto_enriquecimento")
      .select("id", { count: "exact", head: true })
      .eq("status", "aprovado"),
    sb
      .from("produto_enriquecimento")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejeitado"),
  ]);

  const itens = (data ?? []) as unknown as Candidato[];
  const pendentes = count ?? 0;
  const totalPages = Math.ceil(pendentes / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Enriquecimento de fotos</h1>
        <p className="text-sm text-zinc-500">
          Candidatos de foto + descrição buscados no Mercado Livre. Aprovar aplica
          a imagem ao produto; rejeitar descarta.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendentes</p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900">{pendentes}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Aprovados</p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900">{aprovados ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rejeitados</p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900">{rejeitados ?? 0}</p>
        </div>
      </div>

      {pendentes === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-5 py-12 text-center text-zinc-500">
          Nenhum candidato pendente. Rode <code className="rounded bg-zinc-100 px-1">scripts/buscar-fotos-ml.mjs</code> para gerar candidatos.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            Página {page} de {totalPages} · ordenado por maior compatibilidade
          </p>
          <RevisaoList itens={itens} />

          {totalPages > 1 && (
            <div className="flex items-center gap-3 text-sm">
              {page > 1 && (
                <Link
                  href={`/admin/enriquecimento?page=${page - 1}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/enriquecimento?page=${page + 1}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
