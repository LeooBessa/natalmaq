"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { AddToCartBlock } from "@/components/produto/AddToCartBlock";
import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import type { ProdutoComMarca } from "@/types";

type Props = {
  produto: ProdutoComMarca;
  variantes: ProdutoComMarca[];
};

export function ProdutoComVariantes({ produto, variantes }: Props) {
  const opcoes = variantes.length >= 2 ? variantes : [produto];
  const [selecionadoId, setSelecionadoId] = useState<string>(produto.id);

  const atual = opcoes.find((v) => v.id === selecionadoId) ?? produto;

  const preco = atual.preco_promocional ?? atual.preco;
  const temPromo =
    atual.preco_promocional && atual.preco_promocional < atual.preco;
  const inStock = atual.estoque > 0;

  const addItem = useCart((s) => s.addItem);
  const [stickyAdded, setStickyAdded] = useState(false);
  function addSticky() {
    addItem({
      produto_id: atual.id,
      codigo: atual.codigo,
      slug: atual.slug,
      nome: atual.nome,
      imagem: atual.imagens?.[0] ?? null,
      preco_unit: Number(preco),
      quantidade: 1,
      estoque: atual.estoque,
      peso_kg: Number(atual.peso_kg ?? 0),
    });
    setStickyAdded(true);
    setTimeout(() => setStickyAdded(false), 2000);
  }

  const range = useMemo(() => {
    if (opcoes.length < 2) return null;
    const precos = opcoes.map((o) => Number(o.preco_promocional ?? o.preco));
    return { min: Math.min(...precos), max: Math.max(...precos) };
  }, [opcoes]);

  return (
    <>
    <div className="flex flex-col gap-5">
      {atual.marca?.nome && (
        <Link
          href={`/marca/${atual.marca.slug}`}
          className="font-mono text-[11px] uppercase tracking-mono text-brand-500"
        >
          {atual.marca.nome.toUpperCase()}
        </Link>
      )}

      <h1 className="font-display text-[28px] leading-[1.05] tracking-tight text-ink md:text-[34px]">
        {produto.nome}
      </h1>

      <div className="flex items-center gap-3 text-[13px] text-ink-2">
        <span className="font-mono">CÓD. {atual.codigo}</span>
        <span className="text-line">|</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${inStock ? "bg-ok" : "bg-brand-500"}`}
          />
          <span className={inStock ? "text-ok" : "text-brand-500"}>
            {inStock ? `${atual.estoque} em estoque` : "Indisponível"}
          </span>
        </span>
      </div>

      {/* Price card */}
      <div className="bg-navy p-5 text-white">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-mono text-brand-400">
              PREÇO À VISTA
            </div>
            <div className="mt-1 font-display text-[36px] leading-none tracking-tight">
              {formatBRL(preco)}
            </div>
            {temPromo && (
              <div className="mt-2 text-[13px] text-white/60">
                de{" "}
                <span className="line-through">{formatBRL(atual.preco)}</span>
              </div>
            )}
            {range && range.min !== range.max && (
              <div className="mt-2 font-mono text-[11px] uppercase tracking-mono text-white/60">
                Variantes de {formatBRL(range.min)} a {formatBRL(range.max)}
              </div>
            )}
          </div>
          {temPromo && (
            <div className="bg-brand-500 px-2 py-1 font-mono text-[11px] font-bold">
              −
              {Math.round(
                ((Number(atual.preco) - Number(atual.preco_promocional)) /
                  Number(atual.preco)) *
                  100,
              )}
              %
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-white/15 pt-4">
          <AddToCartBlock key={atual.id} produto={atual} />
        </div>
      </div>

      {/* Variant selector */}
      {opcoes.length >= 2 && (
        <div className="space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink">
            TAMANHO / VARIANTE
          </div>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((v) => {
              const isSel = v.id === selecionadoId;
              const indisponivel = v.estoque <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelecionadoId(v.id)}
                  className={[
                    "border px-3 py-1.5 font-mono text-[12px] uppercase tracking-mono transition",
                    isSel
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-line bg-white text-ink hover:border-brand-400",
                    indisponivel && !isSel ? "opacity-40 line-through" : "",
                  ].join(" ")}
                  title={
                    indisponivel
                      ? "Sem estoque"
                      : `${v.estoque} em estoque — ${formatBRL(v.preco_promocional ?? v.preco)}`
                  }
                >
                  {v.variante_label || v.codigo}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {atual.descricao && (
        <p className="leading-relaxed text-ink-2">{atual.descricao}</p>
      )}
    </div>

      {/* CTA fixo (mobile) — reflete a variante selecionada */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(10,22,40,0.10)] md:hidden">
        <div className="shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
            À vista
          </div>
          <div className="font-display text-[22px] leading-none text-ink">
            {formatBRL(preco)}
          </div>
        </div>
        {inStock ? (
          <button
            type="button"
            onClick={addSticky}
            className="flex flex-1 items-center justify-center gap-2 bg-brand-500 py-3.5 font-mono text-[12px] font-bold uppercase tracking-mono text-white transition hover:bg-brand-400"
          >
            {stickyAdded ? (
              <>
                <Check className="h-4 w-4" /> Adicionado
              </>
            ) : (
              <>+ Adicionar ao orçamento</>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 cursor-not-allowed bg-zinc-100 py-3.5 font-mono text-[12px] font-bold uppercase tracking-mono text-zinc-400"
          >
            Indisponível
          </button>
        )}
      </div>
    </>
  );
}
