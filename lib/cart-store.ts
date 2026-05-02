"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

type CartState = {
  itens: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (produto_id: string) => void;
  setQuantidade: (produto_id: string, quantidade: number) => void;
  clear: () => void;
  totalItens: () => number;
  subtotal: () => number;
  pesoTotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      itens: [],
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
      clear: () => set({ itens: [] }),
      totalItens: () => get().itens.reduce((s, i) => s + i.quantidade, 0),
      subtotal: () =>
        get().itens.reduce((s, i) => s + i.preco_unit * i.quantidade, 0),
      pesoTotal: () =>
        get().itens.reduce((s, i) => s + i.peso_kg * i.quantidade, 0),
    }),
    {
      name: "natalmaq-cart-v1",
      // só persiste o array; funções são recriadas a cada hidratação
      partialize: (state) => ({ itens: state.itens }),
    },
  ),
);
