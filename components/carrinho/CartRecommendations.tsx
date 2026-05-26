"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import type { ProdutoComMarca } from "@/types";

const DEBOUNCE_MS = 300;
const LIMIT = 6;

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
    <section className="mx-auto max-w-[1280px] px-6 py-6">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-mono text-ink-2">
        PODE TE INTERESSAR
      </div>
      <h2 className="mb-3 font-display text-[18px] tracking-tight text-ink md:text-[20px]">
        Produtos que combinam com seu carrinho
      </h2>
      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
        aria-busy={loading}
      >
        {loading
          ? Array.from({ length: LIMIT }).map((_, i) => <SkeletonMiniCard key={i} />)
          : recomendacoes.map((p) => <MiniCard key={p.id} produto={p} />)}
      </div>
    </section>
  );
}

function MiniCard({ produto }: { produto: ProdutoComMarca }) {
  const addItem = useCart((s) => s.addItem);
  const preco = produto.preco_promocional ?? produto.preco;
  const img = produto.imagens?.[0];
  const inStock = produto.estoque > 0;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      produto_id: produto.id,
      codigo: produto.codigo,
      slug: produto.slug,
      nome: produto.nome,
      imagem: img ?? null,
      preco_unit: preco,
      quantidade: 1,
      estoque: produto.estoque,
      peso_kg: Number(produto.peso_kg ?? 0),
    });
  }

  return (
    <div className="group flex flex-col border border-line bg-white transition hover:shadow-[0_2px_12px_rgba(10,22,40,0.08)]">
      <Link
        href={`/produto/${produto.slug}`}
        className="relative block h-24 border-b border-line bg-bone"
      >
        {img ? (
          <Image
            src={img}
            alt={produto.nome}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 17vw"
            className="object-contain p-1.5"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-mono text-ink-2/50">
            [ sem foto ]
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-2">
        <Link href={`/produto/${produto.slug}`}>
          <h3 className="line-clamp-2 min-h-[1.8rem] text-[11px] font-semibold leading-tight text-ink hover:text-brand-500">
            {produto.nome}
          </h3>
        </Link>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="font-display text-[12px] tracking-tight text-ink">
            {formatBRL(preco)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!inStock}
            aria-label={`Adicionar ${produto.nome} ao carrinho`}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-navy bg-white text-navy transition hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-ink-2"
          >
            <Plus className="h-3 w-3" strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonMiniCard() {
  return (
    <div aria-hidden="true" className="flex flex-col border border-line bg-white">
      <div className="h-24 animate-pulse bg-bone" />
      <div className="space-y-1.5 p-2">
        <div className="h-2.5 w-full animate-pulse bg-bone" />
        <div className="h-2.5 w-3/4 animate-pulse bg-bone" />
        <div className="mt-0.5 h-3 w-12 animate-pulse bg-bone" />
      </div>
    </div>
  );
}
