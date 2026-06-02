// Chips de categorias e marcas relacionadas (navegação lateral/inferior do
// artigo/landing). RSC.
//
// Recebe LinkTarget[] de categorias e/ou marcas (do RelatedBundle). Hrefs já vêm
// resolvidos no LinkTarget (categoria -> /catalogo?categoria={slug};
// marca -> /marca/{slug}). Estilo: badge igual ao da categoria do artigo
// (font-mono uppercase tracking-mono, borda brand-500/50). Não renderiza nada se
// ambas as listas vierem vazias.

import Link from "next/link";

import { LINK_RULES } from "@/lib/seo/config";
import type { LinkTarget } from "@/lib/seo/internal-links";

interface CategoriasRelacionadasProps {
  categorias?: LinkTarget[];
  marcas?: LinkTarget[];
  titulo?: string;
}

const CHIP_CLASS =
  "inline-block border border-brand-500/50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-mono text-brand-500 transition hover:bg-brand-500 hover:text-white";

export function CategoriasRelacionadas({
  categorias = [],
  marcas = [],
  titulo = "Explore no catálogo",
}: CategoriasRelacionadasProps) {
  const cats = categorias.slice(0, LINK_RULES.MAX_CATEGORIAS);
  const mks = marcas.slice(0, LINK_RULES.MAX_MARCAS);
  if (cats.length === 0 && mks.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-4 font-mono text-[12px] font-bold uppercase tracking-mono text-ink-2">
        {titulo}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {cats.map((c) => (
          <Link key={c.href} href={c.href} className={CHIP_CLASS}>
            {c.nome}
          </Link>
        ))}
        {mks.map((m) => (
          <Link key={m.href} href={m.href} className={CHIP_CLASS}>
            {m.nome}
          </Link>
        ))}
      </div>
    </section>
  );
}
