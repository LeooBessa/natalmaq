"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AjusteEstoque, CartItem, EstoqueAtual } from "@/types";

type CupomAplicado = {
  codigo: string;
  descricao: string | null;
  desconto: number;
};

type CartState = {
  itens: CartItem[];
  cupom: CupomAplicado | null;
  propostaId: string;
  addItem: (item: CartItem) => void;
  removeItem: (produto_id: string) => void;
  setQuantidade: (produto_id: string, quantidade: number) => void;
  // Atualiza o estoque dos itens com o dado fresco do catálogo e devolve o que
  // mudou, pra tela poder avisar o cliente.
  aplicarEstoqueAtual: (atuais: EstoqueAtual[]) => AjusteEstoque[];
  clear: () => void;
  aplicarCupom: (cupom: CupomAplicado) => void;
  removerCupom: () => void;
  totalItens: () => number;
  subtotal: () => number;
  // Subtotal só dos itens SEM promoção — base elegível para cupom.
  subtotalSemPromo: () => number;
  temItemEmPromocao: () => boolean;
  pesoTotal: () => number;
};

function gerarPropostaId() {
  const ano = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return `NM-${ano}-${seq}`;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      itens: [],
      cupom: null,
      propostaId: gerarPropostaId(),
      addItem: (item) => {
        const itens = [...get().itens];
        const idx = itens.findIndex((i) => i.produto_id === item.produto_id);
        if (idx >= 0) {
          const existente = itens[idx];
          const nova = Math.min(
            existente.quantidade + item.quantidade,
            existente.estoque,
          );
          itens[idx] = { ...existente, quantidade: nova };
        } else {
          itens.push({
            ...item,
            quantidade: Math.min(item.quantidade, item.estoque),
          });
        }
        set({ itens });
      },
      removeItem: (produto_id) =>
        set({ itens: get().itens.filter((i) => i.produto_id !== produto_id) }),
      setQuantidade: (produto_id, quantidade) => {
        set({
          itens: get().itens.map((i) =>
            i.produto_id === produto_id
              ? { ...i, quantidade: Math.max(1, Math.min(quantidade, i.estoque)) }
              : i,
          ),
        });
      },
      aplicarEstoqueAtual: (atuais) => {
        const mapa = new Map(atuais.map((a) => [a.produto_id, a.estoque]));
        const ajustes: AjusteEstoque[] = [];
        let mudou = false;

        const itens = get().itens.map((i) => {
          // Ausente da consulta = inativo ou fora do catálogo: trata como esgotado.
          const estoque = mapa.get(i.produto_id) ?? 0;

          if (estoque <= 0) {
            ajustes.push({ tipo: "esgotado", produto_id: i.produto_id, nome: i.nome });
            if (i.estoque === 0) return i;
            mudou = true;
            return { ...i, estoque: 0 };
          }

          if (i.quantidade > estoque) {
            ajustes.push({
              tipo: "ajustado",
              produto_id: i.produto_id,
              nome: i.nome,
              de: i.quantidade,
              para: estoque,
            });
            mudou = true;
            return { ...i, estoque, quantidade: estoque };
          }

          if (i.estoque === estoque) return i;
          mudou = true;
          return { ...i, estoque };
        });

        if (mudou) set({ itens });
        return ajustes;
      },
      clear: () => set({ itens: [], cupom: null, propostaId: gerarPropostaId() }),
      aplicarCupom: (cupom) => set({ cupom }),
      removerCupom: () => set({ cupom: null }),
      totalItens: () => get().itens.reduce((s, i) => s + i.quantidade, 0),
      subtotal: () =>
        get().itens.reduce((s, i) => s + i.preco_unit * i.quantidade, 0),
      subtotalSemPromo: () =>
        get()
          .itens.filter((i) => !i.em_promocao)
          .reduce((s, i) => s + i.preco_unit * i.quantidade, 0),
      temItemEmPromocao: () => get().itens.some((i) => i.em_promocao),
      pesoTotal: () =>
        get().itens.reduce((s, i) => s + i.peso_kg * i.quantidade, 0),
    }),
    {
      name: "natalmaq-cart-v1",
      partialize: (state) => ({ itens: state.itens, propostaId: state.propostaId }),
    },
  ),
);
