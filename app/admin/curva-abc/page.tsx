import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curva ABC" };

type SearchParams = Promise<{ periodo?: string }>;

const PERIODOS = [
  { key: "30", label: "30 dias", dias: 30 },
  { key: "90", label: "90 dias", dias: 90 },
  { key: "365", label: "12 meses", dias: 365 },
  { key: "tudo", label: "Tudo", dias: null },
] as const;

type ItemRow = {
  pedido_id: string;
  produto_id: string | null;
  codigo: string;
  nome_snapshot: string;
  quantidade: number;
  preco_total: number;
};

type Agg = {
  produto_id: string | null;
  codigo: string;
  nome: string;
  quantidade: number;
  receita: number;
  pedidos: Set<string>;
};

// Limiares clássicos da Curva ABC (% acumulado do faturamento)
const LIMITE_A = 80;
const LIMITE_B = 95;

const CLASSE_STYLE: Record<string, { badge: string; card: string; texto: string }> = {
  A: { badge: "bg-emerald-100 text-emerald-700", card: "border-emerald-200 bg-emerald-50", texto: "text-emerald-700" },
  B: { badge: "bg-amber-100 text-amber-700", card: "border-amber-200 bg-amber-50", texto: "text-amber-700" },
  C: { badge: "bg-zinc-200 text-zinc-600", card: "border-zinc-200 bg-zinc-50", texto: "text-zinc-600" },
};

export default async function CurvaAbcPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const periodoKey = PERIODOS.some((p) => p.key === sp.periodo)
    ? (sp.periodo as string)
    : "90";
  const periodo = PERIODOS.find((p) => p.key === periodoKey)!;

  const sb = await createSupabaseServerClient();

  const since = periodo.dias
    ? new Date(Date.now() - periodo.dias * 86_400_000).toISOString()
    : null;

  // Busca todos os itens de pedidos não recusados no período (paginado de 1000 em 1000)
  const itens: ItemRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from("pedido_itens")
      .select(
        "pedido_id, produto_id, codigo, nome_snapshot, quantidade, preco_total, pedidos!inner(status, criado_em)",
      )
      .neq("pedidos.status", "recusado")
      .range(from, from + PAGE - 1);
    if (since) q = q.gte("pedidos.criado_em", since);

    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    for (const r of data as unknown as ItemRow[]) {
      itens.push({
        pedido_id: r.pedido_id,
        produto_id: r.produto_id,
        codigo: r.codigo,
        nome_snapshot: r.nome_snapshot,
        quantidade: Number(r.quantidade),
        preco_total: Number(r.preco_total),
      });
    }
    if (data.length < PAGE) break;
  }

  // Agrega por produto
  const map = new Map<string, Agg>();
  for (const it of itens) {
    const key = it.produto_id ?? `cod:${it.codigo}`;
    let a = map.get(key);
    if (!a) {
      a = {
        produto_id: it.produto_id,
        codigo: it.codigo,
        nome: it.nome_snapshot,
        quantidade: 0,
        receita: 0,
        pedidos: new Set(),
      };
      map.set(key, a);
    }
    a.quantidade += it.quantidade;
    a.receita += it.preco_total;
    a.pedidos.add(it.pedido_id);
  }

  const ranked = [...map.values()].sort((x, y) => y.receita - x.receita);
  const totalReceita = ranked.reduce((s, r) => s + r.receita, 0);

  // Classifica por % acumulado do faturamento
  let cum = 0;
  const rows = ranked.map((r, i) => {
    cum += r.receita;
    const cumPct = totalReceita ? (cum / totalReceita) * 100 : 0;
    const pct = totalReceita ? (r.receita / totalReceita) * 100 : 0;
    const classe = cumPct <= LIMITE_A ? "A" : cumPct <= LIMITE_B ? "B" : "C";
    return { ...r, rank: i + 1, pct, cumPct, classe };
  });

  const resumo = (["A", "B", "C"] as const).map((c) => {
    const sub = rows.filter((r) => r.classe === c);
    return {
      classe: c,
      produtos: sub.length,
      receita: sub.reduce((s, r) => s + r.receita, 0),
      pctReceita: totalReceita
        ? (sub.reduce((s, r) => s + r.receita, 0) / totalReceita) * 100
        : 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Curva ABC</h1>
        <p className="text-sm text-zinc-500">
          Produtos classificados pela participação no faturamento (pedidos não recusados).
        </p>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => {
          const ativo = p.key === periodoKey;
          return (
            <Link
              key={p.key}
              href={`/admin/curva-abc?periodo=${p.key}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                ativo
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {/* Resumo por classe */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {resumo.map((r) => {
          const st = CLASSE_STYLE[r.classe];
          return (
            <div key={r.classe} className={`rounded-lg border p-4 shadow-sm ${st.card}`}>
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${st.badge}`}
                >
                  Classe {r.classe}
                </span>
                <span className={`text-xs font-semibold ${st.texto}`}>
                  {r.pctReceita.toFixed(1)}% do faturamento
                </span>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-zinc-900">
                {formatBRL(r.receita)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {r.produtos} produto{r.produtos !== 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>

      <p className="rounded-md bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
        <strong>Classe A</strong>: até {LIMITE_A}% acumulado · <strong>Classe B</strong>:
        de {LIMITE_A}% a {LIMITE_B}% · <strong>Classe C</strong>: acima de {LIMITE_B}%.
        Faturamento total no período: <strong>{formatBRL(totalReceita)}</strong>.
      </p>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2 text-right">Qtd.</th>
              <th className="px-4 py-2 text-right">Pedidos</th>
              <th className="px-4 py-2 text-right">Faturamento</th>
              <th className="px-4 py-2 text-right">% total</th>
              <th className="px-4 py-2 text-right">% acum.</th>
              <th className="px-4 py-2 text-center">Classe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = CLASSE_STYLE[r.classe];
              return (
                <tr
                  key={r.produto_id ?? `cod:${r.codigo}`}
                  className="border-t border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-4 py-2 text-zinc-400">{r.rank}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.codigo}</td>
                  <td className="px-4 py-2">
                    {r.produto_id ? (
                      <Link
                        href={`/admin/produtos/${r.produto_id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {r.nome}
                      </Link>
                    ) : (
                      <span className="font-medium text-zinc-500">{r.nome}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{r.quantidade}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {r.pedidos.size}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatBRL(r.receita)}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {r.pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {r.cumPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.badge}`}
                    >
                      {r.classe}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  Nenhuma venda registrada no período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
