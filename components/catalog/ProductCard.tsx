"use client";

import Link from "next/link";

import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import type { ProdutoComMarca } from "@/types";

export function ProductCard({ produto }: { produto: ProdutoComMarca }) {
  const addItem = useCart((s) => s.addItem);
  const preco = produto.preco_promocional ?? produto.preco;
  const temPromo =
    produto.preco_promocional && produto.preco_promocional < produto.preco;
  const img = produto.imagens?.[0];

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

  const inStock = produto.estoque > 0;

  return (
    <div className="group flex flex-col border border-line bg-white transition hover:shadow-[0_4px_20px_rgba(10,22,40,0.08)]">
      <Link
        href={`/produto/${produto.slug}`}
        className="relative block aspect-square overflow-hidden border-b border-line bg-bone"
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={produto.nome}
            className="h-full w-full object-contain p-3 transition group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-mono text-ink-2/50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(15,31,61,0.04) 0 1px, transparent 1px 12px)",
            }}
          >
            [ sem foto ]
          </div>
        )}
        {temPromo && (
          <span className="absolute left-2.5 top-2.5 bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-mono text-white">
            Promo
          </span>
        )}
        <span className="absolute bottom-2.5 left-2.5 bg-white/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-mono text-ink-2">
          {produto.codigo}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {produto.marca?.nome && (
          <Link
            href={`/marca/${produto.marca.slug}`}
            className="font-mono text-[10px] uppercase tracking-mono text-ink-2 hover:text-brand-500"
          >
            {produto.marca.nome}
          </Link>
        )}
        <Link href={`/produto/${produto.slug}`}>
          <h3 className="mt-1 line-clamp-2 min-h-[2.4rem] text-[14px] font-semibold leading-snug text-ink hover:text-brand-500">
            {produto.nome}
          </h3>
        </Link>

        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${inStock ? "bg-ok" : "bg-brand-500"}`}
          />
          <span className="text-ink-2">
            {inStock ? `${produto.estoque} em estoque` : "Indisponível"}
          </span>
        </div>

        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
            A partir de
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[20px] tracking-tight text-ink">
              {formatBRL(preco)}
            </span>
            {temPromo && (
              <span className="text-xs text-ink-2 line-through">
                {formatBRL(produto.preco)}
              </span>
            )}
          </div>
        </div>

        <button
          disabled={!inStock}
          onClick={handleAdd}
          className="mt-3 w-full bg-navy py-2.5 font-mono text-[11px] font-bold uppercase tracking-mono text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-2"
        >
          + Orçamento
        </button>
      </div>
    </div>
  );
}
