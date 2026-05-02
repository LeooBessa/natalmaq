import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

type Pedido = {
  id: string;
  numero: number;
  cliente_nome: string;
  total: number;
  status: string;
  criado_em: string;
};

export default async function DashboardPage() {
  const sb = await createSupabaseServerClient();

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayIso = new Date(new Date().toISOString().slice(0, 10)).toISOString();

  const [
    { count: produtosCount },
    { count: pendentesCount },
    { count: hojeCount },
    { count: semanaCount },
    { count: mesCount },
    { data: ultimosPedidosRaw },
  ] = await Promise.all([
    sb.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true),
    sb.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    sb.from("pedidos").select("id", { count: "exact", head: true }).gte("criado_em", todayIso),
    sb.from("pedidos").select("id", { count: "exact", head: true }).gte("criado_em", since7),
    sb.from("pedidos").select("id", { count: "exact", head: true }).gte("criado_em", since30),
    sb.from("pedidos")
      .select("id, numero, cliente_nome, total, status, criado_em")
      .order("criado_em", { ascending: false })
      .limit(10),
  ]);

  const ultimos = (ultimosPedidosRaw ?? []) as Pedido[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card label="Produtos ativos" value={produtosCount ?? 0} />
        <Card label="Pedidos pendentes" value={pendentesCount ?? 0} highlight />
        <Card label="Pedidos hoje" value={hojeCount ?? 0} />
        <Card label="Últimos 7 dias" value={semanaCount ?? 0} />
        <Card label="Últimos 30 dias" value={mesCount ?? 0} />
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-semibold">Últimos pedidos</h2>
          <Link
            href="/admin/pedidos"
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-2">#</th>
              <th className="px-5 py-2">Cliente</th>
              <th className="px-5 py-2">Total</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">Quando</th>
            </tr>
          </thead>
          <tbody>
            {ultimos.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td className="px-5 py-2 font-mono">
                  <Link
                    href={`/admin/pedidos/${p.id}` as never}
                    className="hover:text-brand-600"
                  >
                    #{String(p.numero).padStart(5, "0")}
                  </Link>
                </td>
                <td className="px-5 py-2">{p.cliente_nome}</td>
                <td className="px-5 py-2">{formatBRL(Number(p.total))}</td>
                <td className="px-5 py-2"><StatusBadge status={p.status} /></td>
                <td className="px-5 py-2 text-zinc-500">
                  {new Date(p.criado_em).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
            {ultimos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  Nenhum pedido ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-brand-200 bg-brand-50"
          : "border-zinc-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-extrabold ${
          highlight ? "text-brand-700" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    aprovado: "bg-blue-100 text-blue-800",
    enviado: "bg-green-100 text-green-800",
    recusado: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        styles[status] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}
