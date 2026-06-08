import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RevisaoList, type Candidato } from "./RevisaoList";
import { BuscaPanel } from "./BuscaPanel";
import { AutoAprovarPanel } from "./AutoAprovarPanel";
import { RevisaoAprovados, type Auditado } from "./RevisaoAprovados";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
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

  const [
    { data, count },
    { count: aprovados },
    { count: rejeitados },
    { count: semFoto },
    { data: auditData, count: auditCount },
  ] = await Promise.all([
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
    sb
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .or("imagens.is.null,imagens.eq.[]"),
    // Auto-aprovados ainda NÃO auditados (revisado_em null) — duvidosos primeiro.
    sb
      .from("produto_enriquecimento")
      .select("id, titulo, score, produto:produtos(id, codigo, nome, imagens)", {
        count: "exact",
      })
      .eq("status", "aprovado")
      .is("revisado_em", null)
      .order("score", { ascending: true })
      .limit(60),
  ]);

  const itens = (data ?? []) as unknown as Candidato[];
  const pendentes = count ?? 0;
  const totalPages = Math.ceil(pendentes / PAGE_SIZE);
  const auditados = (auditData ?? []) as unknown as Auditado[];
  const aRevisar = auditCount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Enriquecimento de fotos</h1>
        <p className="text-sm text-zinc-500">
          Busca foto + descrição no Mercado Livre para os produtos sem imagem.
          Aprovar aplica a foto ao produto; rejeitar descarta.
        </p>
      </div>

      <BuscaPanel totalSemFoto={semFoto ?? 0} />

      <AutoAprovarPanel />

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

      {aRevisar > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              Revisão dos auto-aprovados ({aRevisar})
            </h2>
            <p className="text-sm text-zinc-500">
              Fotos de imagem única aplicadas automaticamente, das mais duvidosas
              (menor %) primeiro. Confirme as certas (✓), troque (↻) ou remova (🗑) as
              erradas.
            </p>
          </div>
          <RevisaoAprovados itens={auditados} />
        </div>
      )}

      {pendentes === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-5 py-12 text-center text-zinc-500">
          Nenhum candidato pendente. Use o botão acima para buscar candidatos no
          Mercado Livre.
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Fila manual ({pendentes})</h2>
            <p className="text-sm text-zinc-500">
              Página {page} de {totalPages} · os que precisam de olho humano
              (medida não confirmada no anúncio).
            </p>
          </div>
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
