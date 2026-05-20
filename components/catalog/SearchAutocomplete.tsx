"use client";

import Image from "next/image";
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
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Total de itens navegáveis: resultados + "ver todos" (se items.length > 0)
  const totalNavegaveis = items.length + (items.length > 0 ? 1 : 0);

  function buscar() {
    const termo = q.trim();
    if (!termo) return;
    setOpen(false);
    setFocusIdx(-1);
    router.push(`/catalogo?q=${encodeURIComponent(termo)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, totalNavegaveis - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i <= 0 ? -1 : i - 1));
    } else if (e.key === "Enter") {
      if (focusIdx >= 0) {
        // Acionar o link focado via clique no elemento
        const link = listRef.current?.querySelectorAll("a")[focusIdx];
        link?.click();
      } else {
        buscar();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocusIdx(-1);
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocusIdx(-1);
      }
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      setFocusIdx(-1);
      return;
    }
    setLoading(true);
    setFocusIdx(-1);
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

  // Scroll automático do item focado para a view
  useEffect(() => {
    if (focusIdx < 0 || !listRef.current) return;
    const links = listRef.current.querySelectorAll("a");
    links[focusIdx]?.scrollIntoView({ block: "nearest" });
  }, [focusIdx]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-full border border-line bg-bone-2 pl-5 pr-2 py-1 transition focus-within:border-ink-2 focus-within:bg-white">
        <input
          type="search"
          role="combobox"
          aria-label="Buscar produtos"
          aria-expanded={open}
          aria-autocomplete="list"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="o que você procura?"
          className="w-full bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-2"
        />
        <button
          type="button"
          onClick={buscar}
          aria-label="Buscar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-bone hover:text-ink"
        >
          <Search className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      {open && q.trim().length >= 2 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-auto border border-line bg-white shadow-[0_8px_24px_rgba(10,22,40,0.12)]"
        >
          <div className="border-b border-line px-4 py-2 font-mono text-[10px] uppercase tracking-mono text-ink-2">
            {loading
              ? "BUSCANDO..."
              : `${items.length} RESULTADO${items.length !== 1 ? "S" : ""}`}
          </div>
          {!loading && items.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-2">
              Nenhum resultado para &ldquo;{q}&rdquo;.
            </div>
          )}
          {items.map((item, i) => {
            const preco = item.preco_promocional ?? item.preco;
            const img = item.imagens?.[0];
            const isFocused = focusIdx === i;
            return (
              <Link
                key={item.id}
                href={`/produto/${item.slug}`}
                onClick={() => { setOpen(false); setFocusIdx(-1); }}
                role="option"
                aria-selected={isFocused}
                className={`flex items-center gap-3 border-b border-bone-2 px-4 py-2 last:border-b-0 ${
                  isFocused ? "bg-bone" : "hover:bg-bone"
                }`}
              >
                {img ? (
                  <div className="relative h-11 w-11 shrink-0">
                    <Image src={img} alt="" fill sizes="44px" className="object-contain" />
                  </div>
                ) : (
                  <div className="h-11 w-11 shrink-0 bg-bone" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{item.nome}</div>
                  <div className="font-mono text-[11px] text-ink-2">{formatBRL(preco)}</div>
                </div>
                <span className="font-mono text-[12px] text-brand-500">→</span>
              </Link>
            );
          })}
          {items.length > 0 && (
            <Link
              href={`/catalogo?q=${encodeURIComponent(q)}`}
              onClick={() => { setOpen(false); setFocusIdx(-1); }}
              role="option"
              aria-selected={focusIdx === items.length}
              className={`block border-t border-line px-4 py-2 text-center font-mono text-[11px] uppercase tracking-mono text-navy ${
                focusIdx === items.length ? "bg-bone-2" : "bg-bone hover:bg-bone-2"
              }`}
            >
              VER TODOS OS RESULTADOS →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
