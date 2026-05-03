import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportarFotosForm } from "./ImportarFotosForm";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — processa PDFs de até 30MB
export const metadata = { title: "Importar fotos de fornecedor" };

export default async function ImportarFotosPage() {
  const sb = await createSupabaseServerClient();

  const { data: marcas } = await sb
    .from("marcas")
    .select("id, nome, slug, logo_url")
    .order("nome");

  // imports_fotos pode não existir (migration 0005 ainda não aplicada).
  // Trata erro silenciosamente e exibe um aviso pra admin aplicar.
  const importsRes = await sb
    .from("imports_fotos")
    .select(
      "id, arquivo_pdf, status, total_paginas, total_produtos, total_imagens, criado_em, marca:marcas!imports_fotos_marca_id_fkey(nome)",
    )
    .order("criado_em", { ascending: false })
    .limit(20);

  const imports = importsRes.data;
  const migrationPendente =
    !!importsRes.error &&
    /relation .*imports_fotos.* does not exist/i.test(importsRes.error.message ?? "");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Importar fotos via PDF de fornecedor</h1>
        <p className="text-sm text-zinc-500">
          Faça upload do catálogo PDF do fornecedor (Bosch, Makita, ...). O
          sistema extrai automaticamente fotos limpas de produto, descrição
          (tagline + bullets) e códigos de modelo. Depois você revisa e
          aplica aos produtos do catálogo.
        </p>
      </div>

      {migrationPendente && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">⚠️ Migration pendente</p>
          <p className="mt-1">
            A tabela <code className="rounded bg-amber-100 px-1 font-mono">imports_fotos</code>{" "}
            ainda não foi criada. Aplique{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">supabase/migrations/0005_imports_fotos.sql</code>{" "}
            no SQL Editor do Supabase antes de usar essa feature.
          </p>
        </div>
      )}

      <ImportarFotosForm marcas={marcas ?? []} />

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-5 py-3 font-semibold">
          Importações de fotos
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-2">Quando</th>
              <th className="px-5 py-2">Marca</th>
              <th className="px-5 py-2">Arquivo</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2 text-right">Páginas</th>
              <th className="px-5 py-2 text-right">Produtos</th>
              <th className="px-5 py-2 text-right">Fotos</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(imports ?? []).map((imp) => {
              const marca =
                Array.isArray(imp.marca) ? imp.marca[0] : imp.marca;
              return (
                <tr key={imp.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 text-zinc-500">
                    {new Date(imp.criado_em).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-2">{marca?.nome ?? "—"}</td>
                  <td className="px-5 py-2 font-mono text-xs">
                    {imp.arquivo_pdf}
                  </td>
                  <td className="px-5 py-2">
                    <StatusBadge status={imp.status} />
                  </td>
                  <td className="px-5 py-2 text-right">{imp.total_paginas ?? "—"}</td>
                  <td className="px-5 py-2 text-right">{imp.total_produtos ?? "—"}</td>
                  <td className="px-5 py-2 text-right">{imp.total_imagens ?? "—"}</td>
                  <td className="px-5 py-2 text-right">
                    {(imp.status === "aguardando_review" ||
                      imp.status === "aplicado") && (
                      <Link
                        href={`/admin/importar-fotos/${imp.id}` as never}
                        className="font-semibold text-brand-600 hover:underline"
                      >
                        Revisar →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {(imports ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-zinc-500">
                  Nenhuma importação ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processando: "bg-zinc-100 text-zinc-700",
    aguardando_review: "bg-amber-100 text-amber-800",
    aplicado: "bg-green-100 text-green-700",
    cancelado: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}
