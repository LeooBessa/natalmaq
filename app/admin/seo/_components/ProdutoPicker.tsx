"use client";

// Seletor de produtos por nome para a vitrine de landing pages (ItemList no
// schema) e/ou destaque. CONTROLADO: recebe a lista de produtos via prop (o
// caller server-side resolve com listProdutos) + os ids selecionados, e devolve
// os ids via onChange. Mantém a ordem de seleção (curadoria da vitrine).
// doc 05 §9. Design ADMIN (limpo).

import { Search, X, GripVertical, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { input } from "./form-ui";

// Shape mínimo (client-safe): o caller mapeia ProdutoComMarca → PickerProduto.
export type PickerProduto = {
  id: string;
  nome: string;
  /** opcional: código/SKU para diferenciar homônimos. */
  codigo?: string | null;
  /** opcional: thumbnail. */
  imagem?: string | null;
};

export function ProdutoPicker({
  produtos,
  selectedIds,
  onChange,
  max,
}: {
  produtos: PickerProduto[];
  /** ids selecionados, na ORDEM da vitrine. */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** limite opcional de seleção. */
  max?: number;
}) {
  const [q, setQ] = useState("");
  const byId = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  const atLimit = max != null && selectedIds.length >= max;

  const resultados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const sel = new Set(selectedIds);
    return produtos
      .filter(
        (p) =>
          !sel.has(p.id) &&
          (p.nome.toLowerCase().includes(term) ||
            (p.codigo ?? "").toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [q, produtos, selectedIds]);

  function add(id: string) {
    if (atLimit || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQ("");
  }
  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= selectedIds.length) return;
    const arr = [...selectedIds];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  }

  return (
    <div className="space-y-3">
      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            atLimit ? `Limite de ${max} produtos atingido` : "Buscar produto por nome ou código"
          }
          disabled={atLimit}
          className={`${input} pl-9`}
        />
        {q && resultados.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
            {resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  {p.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imagem}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded border border-zinc-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-200 text-zinc-300">
                      <Plus className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  {p.codigo && (
                    <span className="shrink-0 font-mono text-xs text-zinc-400">
                      {p.codigo}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {q && resultados.length === 0 && (
          <p className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-400 shadow-lg">
            Nenhum produto encontrado.
          </p>
        )}
      </div>

      {/* Selecionados (ordem = vitrine) */}
      <ul className="space-y-1.5">
        {selectedIds.map((id, i) => {
          const p = byId.get(id);
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
            >
              <span className="text-zinc-300">
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-zinc-400">{i + 1}</span>
              {p?.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imagem}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded border border-zinc-200 object-cover"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate">
                {p?.nome ?? "(produto removido)"}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded px-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
                  aria-label="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === selectedIds.length - 1}
                  className="rounded px-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
                  aria-label="Descer"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
        {selectedIds.length === 0 && (
          <li className="rounded-md border-2 border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400">
            Nenhum produto na vitrine. Busque acima para adicionar.
          </li>
        )}
      </ul>
    </div>
  );
}
