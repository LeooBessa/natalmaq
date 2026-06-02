import Link from "next/link";
import { TrendingUp, ShoppingCart, Package, ImageOff, Clock } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import {
  PEDIDO_STATUS,
  PEDIDO_STATUS_BORDER,
  PEDIDO_STATUS_LABEL_CURTO,
  PEDIDO_STATUS_TEXT,
} from "../pedidos/_lib/status";
import { StatusBadge } from "../pedidos/_components/StatusBadge";

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

function sumTotal(arr: { total: number }[]) {
  return arr.reduce((acc, r) => acc + Number(r.total), 0);
}

function horasAtras(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const horas = Math.floor(diff / 3_600_000);
  if (horas < 1) return "< 1h";
  if (horas < 24) return `${horas}h atrás`;
  return `${Math.floor(horas / 24)}d atrás`;
}

const STATUS_ORDER = PEDIDO_STATUS;
const STATUS_LABELS = PEDIDO_STATUS_LABEL_CURTO;
const STATUS_BORDER = PEDIDO_STATUS_BORDER;
const STATUS_TEXT = PEDIDO_STATUS_TEXT;

export default async function DashboardPage() {
  const sb = await createSupabaseServerClient();

  const now = Date.now();
  const since7 = new Date(now - 7 * 86_400_000).toISOString();
  const since30 = new Date(now - 30 * 86_400_000).toISOString();
  const todayIso = new Date(new Date().toISOString().slice(0, 10)).toISOString();

  const [
    { data: fatHoje },
    { data: fat7 },
    { data: fat30 },
    { data: allStatuses },
    { data: oldestPendingRaw },
    { count: lowStockCount },
    { count: semFotoCount },
    { data: ultimosPedidosRaw },
  ] = await Promise.all([
    sb.from("pedidos").select("total").gte("criado_em", todayIso).neq("status", "recusado"),
    sb.from("pedidos").select("total").gte("criado_em", since7).neq("status", "recusado"),
    sb.from("pedidos").select("total").gte("criado_em", since30).neq("status", "recusado"),
    sb.from("pedidos").select("status, total"),
    sb.from("pedidos").select("criado_em").eq("status", "pendente").order("criado_em", { ascending: true }).limit(1),
    sb.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true).lte("estoque", 3),
    sb.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true).or("imagens.is.null,imagens.eq.[]"),
    sb.from("pedidos").select("id, numero, cliente_nome, total, status, criado_em").order("criado_em", { ascending: false }).limit(10),
  ]);

  const faturamentoHoje = sumTotal((fatHoje ?? []) as { total: number }[]);
  const faturamento7 = sumTotal((fat7 ?? []) as { total: number }[]);
  const faturamento30 = sumTotal((fat30 ?? []) as { total: number }[]);
  const ticketMedio30 = fat30?.length ? faturamento30 / fat30.length : 0;

  // Aggregate count + revenue per status
  const statusMap: Record<string, { count: number; total: number }> = {};
  for (const r of (allStatuses ?? []) as { status: string; total: number }[]) {
    if (!statusMap[r.status]) statusMap[r.status] = { count: 0, total: 0 };
    statusMap[r.status].count++;
    statusMap[r.status].total += Number(r.total);
  }

  const pendingOldest = (oldestPendingRaw ?? [])[0]?.criado_em as string | undefined;
  const ultimos = (ultimosPedidosRaw ?? []) as Pedido[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>

      {/* Faturamento KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Faturamento hoje"
          value={formatBRL(faturamentoHoje)}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          color="border-green-200 bg-green-50"
        />
        <KpiCard
          label="Últimos 7 dias"
          value={formatBRL(faturamento7)}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          color="border-blue-200 bg-blue-50"
        />
        <KpiCard
          label="Últimos 30 dias"
          value={formatBRL(faturamento30)}
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
          color="border-indigo-200 bg-indigo-50"
        />
        <KpiCard
          label="Ticket médio (30d)"
          value={formatBRL(ticketMedio30)}
          icon={<ShoppingCart className="h-5 w-5 text-purple-600" />}
          color="border-purple-200 bg-purple-50"
        />
      </div>

      {/* Status funnel */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Funil de pedidos
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATUS_ORDER.map((s) => {
            const info = statusMap[s] ?? { count: 0, total: 0 };
            return (
              <Link
                key={s}
                href={`/admin/pedidos?status=${s}`}
                className={`rounded-lg border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md ${STATUS_BORDER[s]}`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${STATUS_TEXT[s]}`}>
                  {STATUS_LABELS[s]}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-zinc-900">{info.count}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{formatBRL(info.total)}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AlertCard
          href="/admin/produtos"
          icon={<Package className="h-5 w-5" />}
          label="Estoque crítico (≤ 3)"
          value={String(lowStockCount ?? 0)}
          sub={`produto${(lowStockCount ?? 0) !== 1 ? "s" : ""}`}
          alert={(lowStockCount ?? 0) > 0}
          alertColor="orange"
        />
        <AlertCard
          href="/admin/produtos"
          icon={<ImageOff className="h-5 w-5" />}
          label="Produtos sem foto"
          value={String(semFotoCount ?? 0)}
          sub={`ativo${(semFotoCount ?? 0) !== 1 ? "s" : ""}`}
          alert={(semFotoCount ?? 0) > 0}
          alertColor="amber"
        />
        <AlertCard
          href="/admin/pedidos?status=pendente"
          icon={<Clock className="h-5 w-5" />}
          label="Pedido pendente + antigo"
          value={pendingOldest ? horasAtras(pendingOldest) : "—"}
          sub={pendingOldest ? new Date(pendingOldest).toLocaleDateString("pt-BR") : "nenhum pendente"}
          alert={!!pendingOldest}
          alertColor="red"
        />
      </div>

      {/* Last orders table */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-semibold text-zinc-900">Últimos pedidos</h2>
          <Link href="/admin/pedidos" className="text-sm font-semibold text-brand-600 hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-2">#</th>
                <th className="px-5 py-2">Cliente</th>
                <th className="px-5 py-2 text-right">Total</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {ultimos.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-5 py-2.5 font-mono text-xs">
                    <Link href={`/admin/pedidos/${p.id}` as never} className="hover:text-brand-600">
                      #{String(p.numero).padStart(5, "0")}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5">{p.cliente_nome}</td>
                  <td className="px-5 py-2.5 text-right font-medium">{formatBRL(Number(p.total))}</td>
                  <td className="px-5 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-2.5 text-zinc-500">
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
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-zinc-900">{value}</p>
    </div>
  );
}

function AlertCard({
  href,
  icon,
  label,
  value,
  sub,
  alert,
  alertColor,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  alert: boolean;
  alertColor: "orange" | "amber" | "red";
}) {
  const colors = {
    orange: { ring: "border-orange-300", bg: "bg-orange-100", text: "text-orange-600" },
    amber: { ring: "border-amber-300", bg: "bg-amber-100", text: "text-amber-600" },
    red: { ring: "border-red-300", bg: "bg-red-100", text: "text-red-600" },
  };
  const c = alert ? colors[alertColor] : { ring: "border-zinc-200", bg: "bg-zinc-100", text: "text-zinc-400" };

  return (
    <Link
      href={href as never}
      className={`flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md ${c.ring}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
        <span className={c.text}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className={`text-xl font-extrabold ${alert ? c.text : "text-zinc-900"}`}>{value}</p>
        <p className="text-xs text-zinc-400">{sub}</p>
      </div>
    </Link>
  );
}
