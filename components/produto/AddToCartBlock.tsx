"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { useCart } from "@/lib/cart-store";
import type { ProdutoComMarca } from "@/types";

/**
 * Bloco de "adicionar ao orçamento" — pensado para ficar dentro do card
 * navy do produto. Inputs claros sobre fundo escuro.
 */
export function AddToCartBlock({ produto }: { produto: ProdutoComMarca }) {
  const [qty, setQty] = useState(1);
  const [adicionado, setAdicionado] = useState(false);
  const addItem = useCart((s) => s.addItem);
  const preco = produto.preco_promocional ?? produto.preco;

  function handleAdd() {
    addItem({
      produto_id: produto.id,
      codigo: produto.codigo,
      slug: produto.slug,
      nome: produto.nome,
      imagem: produto.imagens?.[0] ?? null,
      preco_unit: Number(preco),
      quantidade: qty,
      estoque: produto.estoque,
      peso_kg: Number(produto.peso_kg ?? 0),
    });
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2000);
  }

  if (produto.estoque <= 0) {
    return (
      <button
        disabled
        className="w-full cursor-not-allowed bg-white/10 py-3 font-mono text-[12px] font-bold uppercase tracking-mono text-white/50"
      >
        Produto indisponível
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex border border-white/30">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-11 py-3 text-white/80 hover:text-white md:w-9 md:py-2.5"
        >
          −
        </button>
        <input
          type="number"
          value={qty}
          onChange={(e) =>
            setQty(
              Math.max(1, Math.min(produto.estoque, Number(e.target.value) || 1)),
            )
          }
          className="w-14 bg-transparent text-center font-bold text-white outline-none md:w-12"
        />
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(produto.estoque, q + 1))}
          className="w-11 py-3 text-white/80 hover:text-white md:w-9 md:py-2.5"
        >
          +
        </button>
      </div>
      <button
        onClick={handleAdd}
        className="flex flex-1 items-center justify-center gap-2 bg-brand-500 py-3 font-mono text-[12px] font-bold uppercase tracking-mono text-white transition hover:bg-brand-400"
      >
        {adicionado ? (
          <>
            <Check className="h-4 w-4" />
            Adicionado
          </>
        ) : (
          <>+ Adicionar ao orçamento</>
        )}
      </button>
    </div>
  );
}
