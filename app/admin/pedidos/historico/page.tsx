import Link from "next/link";
import { MessageCircle, Archive } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { StatusBadge } from "../../dashboard/page";
import {
  PEDIDO_STATUS_LABEL_CURTO,
  type PedidoStatus,
} from "../_lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Histórico de pedidos" };

const FINALIZADO_STATUSES: readonly PedidoStatus[] = ["enviado", "recusado"];
const SORT_OPTIONS = [
  { value: "data_desc", label: "Mais recentes" },
  { value: "data_asc", label: "Mais antigos" },
  { value: "valor_desc", label: "Maior valor" },
  { value: "valor_asc", label: "Menor valor" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

type SearchParams = Promise<{
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  valor_min?: string;
  valor_max?: string;
  sort?: string;
  page?: string;
}>;

const PAGE_SIZE = 30;

function isSortValue(v: string | undefined): v is SortValue {
  return SORT_OPTIONS.some((o) => o.value === v);
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const sb = await createSupabaseServerClient();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;
  const sort: SortValue = isSortValue(sp.sort) ? sp.sort : "data_desc";

  let query = sb
    .from("pedidos")
    .select(
      "id, numero, cliente_nome, cliente_telefone, total, status, criado_em, enviado_em, recusado_em",
      { count: "exact" },
    );

  // Apenas pedidos finalizados (enviado/recusado)
  if (sp.status && (FINALIZADO_STATUSES as readonly string[]).includes(sp.status)) {
    query = query.eq("status", sp.status);
  } else {
    query = query.in("status", FINALIZADO_STATUSES as unknown as string[]);
  }

  if (sp.q) {
    // numero exato OU nome OU telefone
    const num = Number(sp.q.replace(/\D/g, ""));
    if (Number.isFinite(num) && num > 0) {
      query = query.or(
        `cliente_nome.ilike.%${sp.q}%,cliente_telefone.ilike.%${sp.q}%,numero.eq.${num}`,
      );
    } else {
      query = query.or(
        `cliente_nome.ilike.%${sp.q}%,cliente_telefone.ilike.%${sp.q}%`,
      );
    }
  }
  if (sp.from) query = query.gte("criado_em", sp.from);
  if (sp.to) query = query.lte("criado_em", sp.to + "T23:59:59");
  if (sp.valor_min) query = query.gte("total", sp.valor_min);
  if (sp.valor_max) query = query.lte("total", sp.valor_max);

  switch (sort) {
    case "data_asc":
      query = query.order("criado_em", { ascending: true });
      break;
    case "data_desc":
      query = query.order("criado_em", { ascending: false });
      break;
    case "valor_asc":
      query = query.order("total", { ascending: true });
      break;
    case "valor_desc":
      query = query.order("total", { ascending: false });
      break;
  }

  const { data, count } = await query.range(start, end);

  const pedidos = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-zinc-100 p-2">
            <Archive className="h-5 w-5 text-zinc-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Histórico de pedidos</h1>
            <p className="text-sm text-zinc-500">
              {total} pedido{total !== 1 ? "s" : ""} finalizado{total !== 1 ? "s" : ""}{" "}
              (enviado ou recusado)
            </p>
          </div>
        </div>
        <Link
          href="/admin/pedidos/kanban"
          className="rounded-md border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
        >
          ← Kanban
        </Link>
      </div>

      {/* Filtros */}
      <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-4 lg:grid-cols-7">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Busca (cliente, telefone ou nº pedido)
          </label>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Ex: João, 84999, 12345"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Status</label>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {FINALIZADO_STATUSES.map((s) => (
              <option key={s} value={s}>{PEDIDO_STATUS_LABEL_CURTO[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">De</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Valor mín. (R$)</label>
          <input
            type="number"
            name="valor_min"
            min="0"
            step="0.01"
            defaultValue={sp.valor_min ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Valor máx. (R$)</label>
          <input
            type="number"
            name="valor_max"
            min="0"
            step="0.01"
            defaultValue={sp.valor_max ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Ordenar</label>
          <select
            name="sort"
            defaultValue={sort}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-4 lg:col-span-7">
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
          <Link
            href="/admin/pedidos/historico"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Limpar
          </Link>
        </div>
      </form>

      {/* Tabela */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-2">#</th>
              <th className="px-5 py-2">Cliente</th>
              <th className="px-5 py-2">Telefone</th>
              <th className="px-5 py-2 text-right">Total</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2">Finalizado em</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => {
              const finalizadoEm =
                p.status === "enviado" ? p.enviado_em :
                p.status === "recusado" ? p.recusado_em :
                null;
              return (
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
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2">
                      <span>{p.cliente_telefone}</span>
                      {p.cliente_telefone && (
                        <a
                          href={`https://wa.me/55${p.cliente_telefone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Contato WhatsApp"
                          className="text-green-600 hover:text-green-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-2 text-right font-medium">{formatBRL(Number(p.total))}</td>
                  <td className="px-5 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-2 text-zinc-500">
                    {finalizadoEm
                      ? new Date(finalizadoEm).toLocaleString("pt-BR")
                      : "—"}
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
              );
            })}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                  Nenhum pedido finalizado encontrado com esses filtros.
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
  sp: Awaited<SearchParams>;
}) {
  function buildHref(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v && k !== "page") params.set(k, v);
    }
    params.set("page", String(p));
    return `/admin/pedidos/historico?${params}`;
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
