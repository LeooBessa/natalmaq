"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";

import { NavStrip } from "@/components/NavStrip";
import { SearchAutocomplete } from "@/components/catalog/SearchAutocomplete";
import { UserNavBar } from "@/components/UserNavBar";
import { useCart } from "@/lib/cart-store";
import type { Categoria, Marca } from "@/types";

type Props = {
  categorias: Categoria[];
  marcas: Marca[];
};

export function Header({ categorias, marcas }: Props) {
  const total = useCart((s) => s.totalItens());
  // Cart vem do localStorage (zustand persist) → no SSR é sempre 0.
  // Só renderiza o badge após mount para evitar hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const totalVisivel = mounted ? total : 0;

  return (
    <header className="sticky top-0 z-40">
      {/* Main bar — bone, logo + search + cart */}
      <div className="border-b border-line bg-bone">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-4 md:gap-8 md:px-6">
          <Link href="/" className="block shrink-0">
            <Image
              src="/brand/natalmaq-lockup.png"
              alt="Natalmaq — máquinas, ferramentas, equipamentos e EPI's"
              width={2048}
              height={504}
              priority
              className="h-10 w-auto md:h-12"
            />
          </Link>

          <div className="hidden flex-1 md:block">
            <SearchAutocomplete />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Entrar / Minha conta — visível em todos os tamanhos */}
            <UserNavBar />
            <Link
              href="/carrinho"
              aria-label={`Carrinho${totalVisivel > 0 ? ` com ${totalVisivel} ${totalVisivel === 1 ? "item" : "itens"}` : ""}`}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand-500 bg-white text-brand-500 transition hover:bg-brand-50 hover:text-brand-600"
            >
              <ShoppingCart className="h-5 w-5" strokeWidth={2.25} />
              {totalVisivel > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-white ring-2 ring-bone">
                  {totalVisivel > 99 ? "99+" : totalVisivel}
                </span>
              )}
            </Link>
          </div>
        </div>
        {/* Mobile search row */}
        <div className="border-t border-line/60 px-4 pb-3 pt-2 md:hidden">
          <SearchAutocomplete />
        </div>
      </div>

      {/* Category nav — navy stripe com dropdowns */}
      <NavStrip categorias={categorias} marcas={marcas} />
    </header>
  );
}
