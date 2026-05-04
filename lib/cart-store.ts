"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

type CupomAplicado = {
  codigo: string;
  descricao: string | null;
  desconto: number;
};

type CartState = {
  itens: CartItem[];
  cupom: CupomAplicado | null;
  addItem: (item: CartItem) => void;
  removeItem: (produto_id: string) => void;
  setQuantidade: (produto_id: string, quantidade: number) => void;
  clear: () => void;
  aplicarCupom: (cupom: CupomAplicado) => void;
  removerCupom: () => void;
  totalItens: () => number;
  subtotal: () => number;
  pesoTotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      itens: [],
      cupom: null,
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
      clear: () => set({ itens: [], cupom: null }),
      aplicarCupom: (cupom) => set({ cupom }),
      removerCupom: () => set({ cupom: null }),
      totalItens: () => get().itens.reduce((s, i) => s + i.quantidade, 0),
      subtotal: () =>
        get().itens.reduce((s, i) => s + i.preco_unit * i.quantidade, 0),
      pesoTotal: () =>
        get().itens.reduce((s, i) => s + i.peso_kg * i.quantidade, 0),
    }),
    {
      name: "natalmaq-cart-v1",
      partialize: (state) => ({ itens: state.itens }),
    },
  ),
);
