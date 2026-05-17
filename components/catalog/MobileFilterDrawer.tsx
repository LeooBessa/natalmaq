"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import type { Categoria, Marca } from "@/types";

type Sp = {
  q?: string;
  categoria?: string;
  marca?: string;
  page?: string;
  promocao?: string;
  estoque?: string;
};

type Props = {
  categorias: Categoria[];
  marcas: Marca[];
  sp: Sp;
  totalAtivos: number;
};

function buildHref(sp: Sp, override: Partial<Sp>): string {
  const params = new URLSearchParams();
  const merged = { ...sp, ...override };
  for (const [k, v] of Object.entries(merged)) {
    if (v && k !== "page") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

export function MobileFilterDrawer({ categorias, marcas, sp, totalAtivos }: Props) {
  const [open, setOpen] = useState(false);
  const em_estoque = sp.estoque === "1";
  const promocao = sp.promocao === "1";

  return (
    <>
      {/* Trigger — barra fixa no topo da listagem mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between border border-line bg-white px-4 py-3 text-sm font-semibold text-ink md:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </span>
        {totalAtivos > 0 && (
          <span className="flex h-5 w-5 items-center justify-center bg-navy font-mono text-[10px] text-white">
            {totalAtivos}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[90vw] flex-col bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header do drawer */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
            Filtros
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar filtros"
            className="text-ink-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo dos filtros */}
        <div className="flex-1 overflow-y-auto p-5">
          <DrawerGroup title="Disponibilidade">
            <DrawerLink
              label="Em estoque"
              href={buildHref(sp, { estoque: em_estoque ? undefined : "1" })}
              checked={em_estoque}
              onClick={() => setOpen(false)}
            />
            <DrawerLink
              label="Em promoção"
              href={buildHref(sp, { promocao: promocao ? undefined : "1" })}
              checked={promocao}
              onClick={() => setOpen(false)}
            />
          </DrawerGroup>

          <DrawerGroup title="Categoria">
            {categorias.map((c) => (
              <DrawerLink
                key={c.id}
                label={c.nome}
                href={buildHref(sp, {
                  categoria: sp.categoria === c.slug ? undefined : c.slug,
                })}
                checked={sp.categoria === c.slug}
                onClick={() => setOpen(false)}
              />
            ))}
          </DrawerGroup>

          <DrawerGroup title="Marca">
            {marcas.map((m) => (
              <DrawerLink
                key={m.id}
                label={m.nome}
                href={buildHref(sp, {
                  marca: sp.marca === m.slug ? undefined : m.slug,
                })}
                checked={sp.marca === m.slug}
                onClick={() => setOpen(false)}
              />
            ))}
          </DrawerGroup>
        </div>

        {/* Rodapé */}
        <div className="border-t border-line p-4">
          <Link
            href="/catalogo"
            onClick={() => setOpen(false)}
            className="block w-full bg-navy py-3 text-center font-mono text-[11px] font-bold uppercase tracking-mono text-white hover:bg-navy-800"
          >
            Limpar todos os filtros
          </Link>
        </div>
      </div>
    </>
  );
}

function DrawerGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-3 border-b-2 border-navy pb-2 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DrawerLink({
  label,
  href,
  checked,
  onClick,
}: {
  label: string;
  href: string;
  checked?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href as never}
      onClick={onClick}
      className={`flex items-center gap-2 py-1.5 text-[13px] ${
        checked ? "font-semibold text-navy" : "text-ink hover:text-brand-500"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border-[1.5px] ${
          checked ? "border-navy bg-navy text-white" : "border-navy bg-white"
        }`}
      >
        {checked && <span className="text-[8px]">✓</span>}
      </span>
      <span className="flex-1">{label}</span>
    </Link>
  );
}
