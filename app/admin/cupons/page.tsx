import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import type { Cupom } from "@/types";
import { toggleCupomAction } from "./actions";
import { BotaoDeletar } from "./BotaoDeletar";

export const dynamic = "force-dynamic";

export default async function CuponsPage() {
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from("cupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) notFound();
  const cupons = (data as Cupom[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cupons de desconto</h1>
          <p className="text-sm text-zinc-500">{cupons.length} cupom{cupons.length !== 1 ? "s" : ""} cadastrado{cupons.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/admin/cupons/novo"
          className="bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Novo cupom
        </Link>
      </div>

      {cupons.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
          Nenhum cupom cadastrado ainda.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-zinc-700">Código</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Desconto</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Mín.</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Usos</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Validade</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Home</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cupons.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-zinc-900">{c.codigo}</div>
                    {c.descricao && <div className="text-xs text-zinc-400">{c.descricao}</div>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-600">
                    {c.tipo === "percentual" ? `${c.valor}%` : formatBRL(c.valor)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {c.valor_minimo > 0 ? formatBRL(c.valor_minimo) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {c.usos_atual}{c.usos_max ? `/${c.usos_max}` : ""}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {c.validade
                      ? new Date(c.validade).toLocaleDateString("pt-BR")
                      : "Sem validade"}
                  </td>
                  <td className="px-4 py-3">
                    {c.exibir_home ? (
                      <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">Sim</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async () => {
                        "use server";
                        await toggleCupomAction(c.id, !c.ativo);
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded px-2 py-0.5 text-xs font-medium ${c.ativo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                      >
                        {c.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/cupons/${c.id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <BotaoDeletar id={c.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
