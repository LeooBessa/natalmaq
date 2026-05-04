"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { formatBRL } from "@/lib/format";

type Item = {
  id: string;
  slug: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  imagens: string[] | null;
};

export function SearchAutocomplete() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  function buscar() {
    const termo = q.trim();
    if (!termo) return;
    setOpen(false);
    router.push(`/catalogo?q=${encodeURIComponent(termo)}`);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.busca.autocomplete(q.trim());
        setItems(res.items as Item[]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={wrapRef} className="relative w-full max-w-2xl">
      <div className="flex border-2 border-navy bg-white">
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search className="h-4 w-4 text-ink-2" strokeWidth={2.5} />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Buscar por código, marca ou produto..."
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-2"
          />
        </div>
        <button
          type="button"
          onClick={buscar}
          className="bg-brand-500 px-5 font-extrabold uppercase tracking-wide text-white text-[13px] hover:bg-brand-400"
        >
          Buscar
        </button>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-auto border border-line bg-white shadow-[0_8px_24px_rgba(10,22,40,0.12)]">
          <div className="border-b border-line px-4 py-2 font-mono text-[10px] uppercase tracking-mono text-ink-2">
            {loading
              ? "BUSCANDO..."
              : `${items.length} RESULTADO${items.length !== 1 ? "S" : ""}`}
          </div>
          {!loading && items.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-2">
              Nenhum resultado para “{q}”.
            </div>
          )}
          {items.map((item) => {
            const preco = item.preco_promocional ?? item.preco;
            const img = item.imagens?.[0];
            return (
              <Link
                key={item.id}
                href={`/produto/${item.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 border-b border-bone-2 px-4 py-2 last:border-b-0 hover:bg-bone"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="h-11 w-11 object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 bg-bone" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {item.nome}
                  </div>
                  <div className="font-mono text-[11px] text-ink-2">
                    {formatBRL(preco)}
                  </div>
                </div>
                <span className="font-mono text-[12px] text-brand-500">→</span>
              </Link>
            );
          })}
          {items.length > 0 && (
            <Link
              href={`/catalogo?q=${encodeURIComponent(q)}`}
              onClick={() => setOpen(false)}
              className="block border-t border-line bg-bone px-4 py-2 text-center font-mono text-[11px] uppercase tracking-mono text-navy hover:bg-bone-2"
            >
              VER TODOS OS RESULTADOS →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
