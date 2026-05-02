import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { StatusBadge } from "../dashboard/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

const STATUSES = ["pendente", "aprovado", "enviado", "recusado"] as const;

type SearchParams = Promise<{
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

const PAGE_SIZE = 30;

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const sb = await createSupabaseServerClient();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  let query = sb
    .from("pedidos")
    .select(
      "id, numero, cliente_nome, cliente_telefone, total, status, criado_em",
      { count: "exact" },
    );

  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) {
    query = query.eq("status", sp.status);
  }
  if (sp.q) {
    query = query.or(
      `cliente_nome.ilike.%${sp.q}%,cliente_telefone.ilike.%${sp.q}%`,
    );
  }
  if (sp.from) query = query.gte("criado_em", sp.from);
  if (sp.to) query = query.lte("criado_em", sp.to + "T23:59:59");

  const { data, count } = await query
    .order("criado_em", { ascending: false })
    .range(start, end);

  const pedidos = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-zinc-500">{total} no total</p>
        </div>
        <Link
          href="/admin/pedidos/kanban"
          className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
        >
          Ver Kanban →
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Status</label>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Cliente / telefone</label>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nome ou telefone"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">De</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filtrar
        </button>
        <Link
          href="/admin/pedidos"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
        >
          Limpar
        </Link>
      </form>

      {/* Tabela */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-2">#</th>
              <th className="px-5 py-2">Cliente</th>
              <th className="px-5 py-2">Telefone</th>
              <th className="px-5 py-2">Total</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">Quando</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
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
                <td className="px-5 py-2">{p.cliente_telefone}</td>
                <td className="px-5 py-2">{formatBRL(Number(p.total))}</td>
                <td className="px-5 py-2"><StatusBadge status={p.status} /></td>
                <td className="px-5 py-2 text-zinc-500">
                  {new Date(p.criado_em).toLocaleString("pt-BR")}
                </td>
                <td className="px-5 py-2 text-right">
                  <Link
                    href={`/admin/pedidos/${p.id}` as never}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Abrir →
                  </Link>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                  Nenhum pedido encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination current={page} total={totalPages} sp={sp} />
      )}
    </div>
  );
}

function Pagination({
  current,
  total,
  sp,
}: {
  current: number;
  total: number;
  sp: { status?: string; q?: string; from?: string; to?: string };
}) {
  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.q) params.set("q", sp.q);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    params.set("page", String(p));
    return `/admin/pedidos?${params}`;
  }
  return (
    <nav className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">
        Página {current} de {total}
      </span>
      <div className="flex gap-2">
        {current > 1 && (
          <Link
            href={buildHref(current - 1) as never}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50"
          >
            ← Anterior
          </Link>
        )}
        {current < total && (
          <Link
            href={buildHref(current + 1) as never}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50"
          >
            Próxima →
          </Link>
        )}
      </div>
    </nav>
  );
}
