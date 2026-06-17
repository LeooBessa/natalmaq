"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { FreteEstimativa } from "@/components/carrinho/FreteEstimativa";
import { CartRecommendations } from "@/components/carrinho/CartRecommendations";

export default function CarrinhoPage() {
  const { itens, setQuantidade, removeItem, subtotal, propostaId } = useCart();
  const total = subtotal();

  return (
    <div className="bg-bone">
      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-6">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / SOLICITAÇÃO DE ORÇAMENTO
          </div>
          <h1 className="mt-2 font-display text-[28px] tracking-tight text-ink md:text-[36px]">
            Meu carrinho
          </h1>
          <div className="mt-1 text-sm text-ink-2">
            {itens.length} item{itens.length !== 1 && "s"}
            {itens.length > 0 && (
              <>
                {" "}
                · proposta provisória{" "}
                <span className="font-mono font-bold text-ink">
                  #{propostaId}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <CartRecommendations />

      <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-8">
        {itens.length === 0 ? (
          <div className="border border-dashed border-line bg-white p-16 text-center">
            <div className="font-mono text-[12px] uppercase tracking-mono text-ink-2">
              CESTA VAZIA
            </div>
            <div className="mt-2 text-lg text-ink">
              Adicione produtos para gerar seu orçamento.
            </div>
            <Link
              href="/catalogo"
              className="mt-6 inline-block bg-navy px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-mono text-white hover:bg-navy-800"
            >
              Explorar catálogo →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              {itens.map((it) => (
                <div
                  key={it.produto_id}
                  className="grid grid-cols-[80px_1fr] gap-4 border border-line bg-white p-4 md:grid-cols-[100px_1fr_auto]"
                >
                  <div className="relative aspect-square bg-bone">
                    {it.imagem && (
                      <Image
                        src={it.imagem}
                        alt={it.nome}
                        fill
                        sizes="100px"
                        className="object-contain p-1"
                      />
                    )}
                  </div>

                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
                      {it.codigo}
                    </div>
                    <Link
                      href={`/produto/${it.slug}`}
                      className="mt-1 block text-[15px] font-semibold text-ink hover:text-brand-500"
                    >
                      {it.nome}
                    </Link>
                    <div className="mt-1 text-xs text-ok">
                      ● Em estoque · entrega em 2 dias úteis
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex border border-line bg-white">
                        <button
                          onClick={() =>
                            setQuantidade(it.produto_id, it.quantidade - 1)
                          }
                          disabled={it.quantidade <= 1}
                          className="w-10 py-2.5 text-ink-2 hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 md:w-8 md:py-1.5"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={it.quantidade}
                          onChange={(e) =>
                            setQuantidade(
                              it.produto_id,
                              Math.max(1, Math.min(it.estoque, Number(e.target.value) || 1)),
                            )
                          }
                          className="w-12 bg-transparent text-center font-mono text-sm font-bold text-ink outline-none md:w-10"
                        />
                        <button
                          onClick={() =>
                            setQuantidade(it.produto_id, it.quantidade + 1)
                          }
                          disabled={it.quantidade >= it.estoque}
                          className="w-10 py-2.5 text-ink-2 hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 md:w-8 md:py-1.5"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(it.produto_id)}
                        className="inline-flex items-center gap-1 text-xs text-ink-2 underline-offset-2 hover:text-brand-500 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 flex flex-col items-end justify-end md:col-span-1">
                    <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
                      {it.quantidade} × {formatBRL(it.preco_unit)}
                    </div>
                    <div className="font-display text-[20px] tracking-tight text-ink">
                      {formatBRL(it.preco_unit * it.quantidade)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit bg-navy p-6 text-white">
              <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-brand-400">
                RESUMO DA PROPOSTA
              </div>
              <Row k="Subtotal" v={formatBRL(total)} />
              <FreteEstimativa />
              <div className="mt-4 border-t border-white/15 pt-4">
                <div className="flex items-end justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-mono text-white/70">
                    TOTAL ESTIMADO
                  </div>
                  <div className="font-display text-[26px] tracking-tight">
                    {formatBRL(total)}
                  </div>
                </div>
              </div>
              <Link
                href="/checkout"
                className="mt-5 block w-full bg-brand-500 py-4 text-center font-mono text-[12px] font-bold uppercase tracking-mono text-white hover:bg-brand-400"
              >
                Continuar pedido →
              </Link>
              <Link
                href="/catalogo"
                className="mt-3 block text-center text-[12px] text-white/70 hover:text-white"
              >
                ← continuar explorando
              </Link>
              <div className="mt-4 text-center text-[11px] leading-relaxed text-white/60">
                Resposta em até 2h úteis · Validade da proposta: 7 dias
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Rodapé fixo (mobile) */}
      {itens.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(10,22,40,0.10)] md:hidden">
          <div className="shrink-0">
            <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
              Total estimado
            </div>
            <div className="font-display text-[22px] leading-none text-ink">
              {formatBRL(total)}
            </div>
          </div>
          <Link
            href="/checkout"
            className="flex flex-1 items-center justify-center bg-brand-500 py-3.5 font-mono text-[12px] font-bold uppercase tracking-mono text-white hover:bg-brand-400"
          >
            Continuar pedido →
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-white/75">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
