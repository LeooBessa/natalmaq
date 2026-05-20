"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Tag, Package, Building2, Info } from "lucide-react";

import type { Categoria, Marca } from "@/types";

type Props = {
  categorias: Categoria[];
  marcas: Marca[];
};

type Open = "cats" | "marcas" | null;

/**
 * Faixa de navegação industrial com dropdowns de Categorias e Marcas
 * (mega-menus) + links diretos para Em estoque, Promoções e Sobre.
 */
export function NavStrip({ categorias, marcas }: Props) {
  const [open, setOpen] = useState<Open>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Fecha ao mudar de rota (NavStrip vive no layout, sobrevive a navegações).
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  // Fecha ao clicar fora ou ao pressionar Esc.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative bg-navy-800 text-white">
      <div className="mx-auto flex max-w-[1280px] items-stretch overflow-x-auto">
        {/* Todas as categorias — mega-menu */}
        <button
          type="button"
          onClick={() => setOpen(open === "cats" ? null : "cats")}
          aria-expanded={open === "cats"}
          className={`flex shrink-0 items-center gap-2.5 px-5 py-3.5 text-[13px] font-extrabold uppercase tracking-wide transition ${
            open === "cats"
              ? "bg-brand-400"
              : "bg-brand-500 hover:bg-brand-400"
          }`}
        >
          <Menu className="h-4 w-4" strokeWidth={2.5} />
          Todas as categorias
          <ChevronDown
            className={`h-4 w-4 transition ${open === "cats" ? "rotate-180" : ""}`}
            strokeWidth={2.5}
          />
        </button>

        <NavLink
          href="/catalogo?estoque=1"
          icon={<Package className="h-3.5 w-3.5" />}
          onClick={() => setOpen(null)}
        >
          Em estoque
        </NavLink>

        {/* Marcas — dropdown */}
        <button
          type="button"
          onClick={() => setOpen(open === "marcas" ? null : "marcas")}
          aria-expanded={open === "marcas"}
          className={`flex shrink-0 items-center gap-2 border-r border-navy-700 px-5 py-3.5 text-[13px] font-medium transition ${
            open === "marcas" ? "bg-navy-700" : "hover:bg-navy-700"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Marcas
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${open === "marcas" ? "rotate-180" : ""}`}
          />
        </button>

        <NavLink
          href="/catalogo?promocao=1"
          icon={<Tag className="h-3.5 w-3.5" />}
          onClick={() => setOpen(null)}
        >
          Promoções
        </NavLink>

        <NavLink
          href="/institucional"
          icon={<Info className="h-3.5 w-3.5" />}
          onClick={() => setOpen(null)}
        >
          Sobre
        </NavLink>
      </div>

      {/* Dropdowns */}
      {open === "cats" && (
        <CategoriasMenu
          categorias={categorias}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "marcas" && (
        <MarcasMenu marcas={marcas} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href as never}
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 border-r border-navy-700 px-5 py-3.5 text-[13px] font-medium hover:bg-navy-700"
    >
      {icon}
      {children}
    </Link>
  );
}

// ─── Mega-menu Categorias ──────────────────────────────────────
function CategoriasMenu({
  categorias,
  onClose,
}: {
  categorias: Categoria[];
  onClose: () => void;
}) {
  if (categorias.length === 0) {
    return (
      <Dropdown>
        <div className="px-6 py-8 text-center font-mono text-[12px] uppercase tracking-mono text-ink-2">
          Nenhuma categoria cadastrada ainda.
        </div>
      </Dropdown>
    );
  }
  // Particiona em 4 colunas pra densidade.
  const cols = 4;
  const buckets: Categoria[][] = Array.from({ length: cols }, () => []);
  categorias.forEach((c, i) => buckets[i % cols].push(c));

  return (
    <Dropdown>
      <div className="border-b border-line bg-bone px-6 py-3 font-mono text-[11px] uppercase tracking-mono text-ink-2">
        {categorias.length} CATEGORIA{categorias.length !== 1 ? "S" : ""} ATIVAS
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-6 py-5 md:grid-cols-4">
        {buckets.map((bucket, i) => (
          <ul key={i} className="space-y-1">
            {bucket.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/catalogo?categoria=${c.slug}` as never}
                  onClick={onClose}
                  className="block py-1 text-sm text-ink hover:text-brand-500"
                >
                  {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <div className="border-t border-line bg-bone px-6 py-3 text-right">
        <Link
          href="/catalogo"
          onClick={onClose}
          className="font-mono text-[11px] uppercase tracking-mono text-navy hover:text-brand-500"
        >
          Ver catálogo completo →
        </Link>
      </div>
    </Dropdown>
  );
}

// ─── Dropdown Marcas ──────────────────────────────────────────
function MarcasMenu({
  marcas,
  onClose,
}: {
  marcas: Marca[];
  onClose: () => void;
}) {
  if (marcas.length === 0) {
    return (
      <Dropdown>
        <div className="px-6 py-8 text-center font-mono text-[12px] uppercase tracking-mono text-ink-2">
          Nenhuma marca cadastrada ainda.
        </div>
      </Dropdown>
    );
  }
  return (
    <Dropdown>
      <div className="border-b border-line bg-bone px-6 py-3 font-mono text-[11px] uppercase tracking-mono text-ink-2">
        {marcas.length} MARCA{marcas.length !== 1 ? "S" : ""} PARCEIRAS
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-6 py-5 md:grid-cols-4">
        {marcas.map((m) => (
          <Link
            key={m.id}
            href={`/marca/${m.slug}` as never}
            onClick={onClose}
            className="block py-1 text-sm text-ink hover:text-brand-500"
          >
            {m.nome}
          </Link>
        ))}
      </div>
    </Dropdown>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 max-h-[min(70vh,640px)] overflow-y-auto border-b border-line bg-white text-ink shadow-[0_8px_32px_rgba(10,22,40,0.18)]">
      <div className="mx-auto max-w-[1280px]">{children}</div>
    </div>
  );
}
