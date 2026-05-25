"use client";

import { useEffect, useState } from "react";

import { ProductCard } from "@/components/catalog/ProductCard";
import { useCart } from "@/lib/cart-store";
import type { ProdutoComMarca } from "@/types";

const DEBOUNCE_MS = 300;
const LIMIT = 3;

export function CartRecommendations() {
  const itens = useCart((s) => s.itens);
  const [recomendacoes, setRecomendacoes] = useState<ProdutoComMarca[]>([]);
  const [loading, setLoading] = useState(false);

  const idsKey = itens.map((i) => i.produto_id).sort().join(",");

  useEffect(() => {
    if (!idsKey) {
      setRecomendacoes([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/produtos/recomendacoes?ids=${idsKey}&limit=${LIMIT}`, {
        signal: controller.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: { items: ProdutoComMarca[] }) => {
          setRecomendacoes(data.items ?? []);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          console.error("CartRecommendations fetch error:", err);
          setRecomendacoes([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [idsKey]);

  // Cart vazio: não renderiza nada
  if (itens.length === 0) return null;
  // Após fetch sem resultados: não renderiza nada
  if (!loading && recomendacoes.length === 0) return null;

  return (
    <section className="mx-auto max-w-[900px] px-6 py-8">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-ink-2">
        PODE TE INTERESSAR
      </div>
      <h2 className="mb-6 font-display text-[22px] tracking-tight text-ink md:text-[26px]">
        Produtos que combinam com sua cesta
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy={loading}>
        {loading
          ? Array.from({ length: LIMIT }).map((_, i) => <SkeletonCard key={i} />)
          : recomendacoes.map((p) => <ProductCard key={p.id} produto={p} />)}
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="flex flex-col border border-line bg-white">
      <div className="aspect-square animate-pulse bg-bone" />
      <div className="space-y-2 p-4">
        <div className="h-2 w-16 animate-pulse bg-bone" />
        <div className="h-4 w-full animate-pulse bg-bone" />
        <div className="h-4 w-3/4 animate-pulse bg-bone" />
        <div className="h-6 w-24 animate-pulse bg-bone" />
        <div className="h-9 w-full animate-pulse bg-bone" />
      </div>
    </div>
  );
}
