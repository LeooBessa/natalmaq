"use client";

import Image from "next/image";
import Link from "next/link";

import { NavStrip } from "@/components/NavStrip";
import { SearchAutocomplete } from "@/components/catalog/SearchAutocomplete";
import { UserNav } from "@/components/UserNav";
import { UserNavBar } from "@/components/UserNavBar";
import { useCart } from "@/lib/cart-store";
import type { Categoria, Marca } from "@/types";

type Props = {
  categorias: Categoria[];
  marcas: Marca[];
};

export function Header({ categorias, marcas }: Props) {
  const total = useCart((s) => s.totalItens());

  return (
    <header className="sticky top-0 z-40">
      {/* Utility bar — navy, mono */}
      <div className="hidden bg-navy px-6 py-2 text-[11px] font-medium uppercase tracking-mono text-white/70 md:block">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between font-mono">
          <div className="flex items-center gap-6">
            <span>FROTA PRÓPRIA · ENTREGA EM TODO O RN</span>
            <span className="text-brand-400">● ATENDIMENTO ATIVO</span>
          </div>
          <div className="flex items-center gap-5">
            <span>(84) 3000-0000</span>
            <span>VENDAS@NATALMAQ.COM.BR</span>
            <UserNav />
          </div>
        </div>
      </div>

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
              className="group inline-flex items-center gap-3 bg-navy px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-navy-800"
            >
              <span className="hidden md:inline">Orçamento</span>
              <span className="md:hidden">Cesta</span>
              <span className="inline-flex min-w-[28px] items-center justify-center bg-brand-500 px-2 py-0.5 font-mono text-xs">
                {total}
              </span>
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
