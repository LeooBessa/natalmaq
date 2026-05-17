import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produtos" };

type SearchParams = Promise<{ q?: string; page?: string }>;
const PAGE_SIZE = 30;

export default async function ProdutosPage({
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
    .from("produtos")
    .select("id, codigo, slug, nome, preco, preco_promocional, estoque, ativo, destaque, imagens, marca:marcas(nome)", { count: "exact" });

  if (sp.q) query = query.or(`nome.ilike.%${sp.q}%,codigo.ilike.%${sp.q}%`);

  const { data, count } = await query
    .order("nome")
    .range(start, end);

  const produtos = (data ?? []) as unknown as Array<{
    id: string;
    codigo: string;
    slug: string;
    nome: string;
    preco: number;
    preco_promocional: number | null;
    estoque: number;
    ativo: boolean;
    destaque: boolean;
    imagens: string[] | null;
    marca: { nome: string } | null;
  }>;

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-zinc-500">{total} no total</p>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Novo produto
        </Link>
      </div>

      <form className="flex items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-zinc-700">Buscar</label>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nome ou código"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-2">Código</th>
              <th className="px-5 py-2">Produto</th>
              <th className="px-5 py-2">Marca</th>
              <th className="px-5 py-2 text-right">Preço</th>
              <th className="px-5 py-2 text-right">Estoque</th>
              <th className="px-5 py-2">Foto</th>
              <th className="px-5 py-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => {
              const preco = p.preco_promocional ?? p.preco;
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 font-mono text-xs">{p.codigo}</td>
                  <td className="px-5 py-2">
                    <Link
                      href={`/admin/produtos/${p.id}` as never}
                      className="font-medium hover:text-brand-600"
                    >
                      {p.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-zinc-500">{p.marca?.nome ?? "—"}</td>
                  <td className="px-5 py-2 text-right">{formatBRL(Number(preco))}</td>
                  <td className="px-5 py-2 text-right">
                    <span className={`inline-flex items-center gap-1 ${
                      p.estoque <= 0
                        ? "font-bold text-red-600"
                        : p.estoque <= 3
                          ? "font-semibold text-orange-600"
                          : ""
                    }`}>
                      {(p.estoque <= 3 && p.estoque > 0) && (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {p.estoque}
                    </span>
                  </td>
                  <td className="px-5 py-2">
                    {p.imagens && p.imagens.length > 0 ? (
                      <span className="text-xs text-zinc-400">✓</span>
                    ) : (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        sem foto
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2 space-x-1">
                    {p.ativo ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        ativo
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                        inativo
                      </span>
                    )}
                    {p.destaque && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        destaque
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <Link
                      href={`/admin/produtos/${p.id}` as never}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Editar →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {produtos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="text-sm text-zinc-500">
          Página {page} de {totalPages}{" "}
          {page > 1 && (
            <Link
              href={`/admin/produtos?q=${sp.q ?? ""}&page=${page - 1}` as never}
              className="ml-3 text-brand-600 hover:underline"
            >
              ← Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/admin/produtos?q=${sp.q ?? ""}&page=${page + 1}` as never}
              className="ml-3 text-brand-600 hover:underline"
            >
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
