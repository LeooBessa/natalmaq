// Bloco "Produtos relacionados" (3–4 cards) ao final do artigo/landing.
//
// RSC: reusa o ProductCard ("use client") — um Server Component pode renderizar
// Client Components normalmente. Recebe os produtos JÁ RESOLVIDOS (ProdutoComMarca)
// pelo caller (custo zero: o caller decide se/quando buscar via lib/data). Não
// renderiza nada se a lista vier vazia.

import { ProductCard } from "@/components/catalog/ProductCard";
import { LINK_RULES } from "@/lib/seo/config";
import type { ProdutoComMarca } from "@/types";

interface RelatedProductsProps {
  produtos: ProdutoComMarca[];
  /** título opcional (default "PRODUTOS RELACIONADOS"). */
  titulo?: string;
}

export function RelatedProducts({
  produtos,
  titulo = "Produtos relacionados",
}: RelatedProductsProps) {
  if (!produtos || produtos.length === 0) return null;

  const items = produtos.slice(0, LINK_RULES.MAX_PRODUTOS_BLOCO);

  return (
    <section className="mt-14">
      <h2 className="mb-6 font-mono text-[12px] font-bold uppercase tracking-mono text-ink-2">
        {titulo}
      </h2>
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} produto={p} />
        ))}
      </div>
    </section>
  );
}
