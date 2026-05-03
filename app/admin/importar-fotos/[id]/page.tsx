import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewBoard } from "./ReviewBoard";

export const dynamic = "force-dynamic";

type ImagemMeta = {
  url: string;
  w: number;
  h: number;
  tipo: string;
  score: number;
};
type ProdutoMeta = {
  page: number;
  tipo: string;
  modelo: string;
  modelo_variante: string | null;
  codigos_pedido: string[];
  tagline: string;
  bullets: string[];
  descricao: string;
  imagens_candidatas_hashes: string[];
};
type Dados = {
  produtos: ProdutoMeta[];
  imagens: Record<string, ImagemMeta>;
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();

  const { data: imp } = await sb
    .from("imports_fotos")
    .select(
      "id, marca_id, arquivo_pdf, status, total_produtos, total_imagens, dados, marca:marcas!imports_fotos_marca_id_fkey(id, nome, slug)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!imp) notFound();

  const dados = imp.dados as Dados | null;
  const marca = Array.isArray(imp.marca) ? imp.marca[0] : imp.marca;

  if (!dados || imp.status === "processando") {
    return (
      <div className="space-y-4">
        <Link
          href={"/admin/importar-fotos" as never}
          className="text-sm text-zinc-500 hover:text-brand-600"
        >
          ← Voltar
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold">Processando o PDF…</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Atualize a página em alguns instantes.
          </p>
        </div>
      </div>
    );
  }

  // Pré-busca produtos da marca para auto-match
  const { data: produtosDaMarca } = await sb
    .from("produtos")
    .select("id, codigo, nome, slug, descricao, imagens")
    .eq("marca_id", imp.marca_id)
    .eq("ativo", true)
    .is("produto_pai_id", null)
    .order("nome")
    .limit(2000);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={"/admin/importar-fotos" as never}
            className="text-sm text-zinc-500 hover:text-brand-600"
          >
            ← Voltar
          </Link>
          <h1 className="mt-2 text-2xl font-bold">
            Revisar fotos — {marca?.nome ?? "?"}
          </h1>
          <p className="text-sm text-zinc-500">
            {imp.arquivo_pdf} · {imp.total_produtos} produtos detectados ·{" "}
            {imp.total_imagens} fotos extraídas · {produtosDaMarca?.length ?? 0}{" "}
            produtos na marca
          </p>
        </div>
        <span
          className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${imp.status === "aplicado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}
        >
          {imp.status}
        </span>
      </div>

      <ReviewBoard
        importId={imp.id}
        produtosPdf={dados.produtos}
        imagens={dados.imagens}
        produtosBanco={produtosDaMarca ?? []}
      />
    </div>
  );
}
