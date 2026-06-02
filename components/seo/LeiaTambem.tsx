// Bloco "Leia também": artigos do mesmo cluster + pillar em destaque.
//
// RSC. Reusa o molde de card de artigo (app/(public)/artigos/page.tsx). Recebe os
// artigos JÁ RESOLVIDOS (LeiaTambemArticle[]) e, opcionalmente, o pillar do cluster
// (LinkTarget type 'cluster', href /guias/{slug}) renderizado como faixa "Guia
// completo: ...". Caller resolve a partir de RelatedBundle.leiaTambem/pillar
// (que são LinkTarget[]) buscando os dados de exibição em lib/conteudo. Não
// renderiza nada se não houver artigos nem pillar.

import Link from "next/link";

import { LINK_RULES } from "@/lib/seo/config";
import type { LinkTarget } from "@/lib/seo/internal-links";

/** Dados mínimos para renderizar o card de artigo no "Leia também". */
export interface LeiaTambemArticle {
  slug: string;
  title: string;
  /** href completo (/artigos/{slug}); opcional — derivado do slug se ausente. */
  href?: string;
  category?: string;
  excerpt?: string;
  image?: string;
  date?: string;
  readingTime?: string;
}

interface LeiaTambemProps {
  artigos: LeiaTambemArticle[];
  /** pillar do cluster (LinkTarget type 'cluster'); vira faixa "Guia completo". */
  pillar?: LinkTarget;
  titulo?: string;
}

export function LeiaTambem({
  artigos,
  pillar,
  titulo = "Leia também",
}: LeiaTambemProps) {
  const items = (artigos ?? []).slice(0, LINK_RULES.MAX_LEIA_TAMBEM);
  if (items.length === 0 && !pillar) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-6 font-mono text-[12px] font-bold uppercase tracking-mono text-ink-2">
        {titulo}
      </h2>

      {/* Pillar em destaque: link "sobe" para o guia completo do cluster. */}
      {pillar && (
        <Link
          href={pillar.href}
          className="group mb-5 flex items-center justify-between gap-4 border border-brand-500/50 bg-navy px-5 py-4 transition hover:bg-navy-800"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-mono text-brand-400">
              Guia completo
            </div>
            <div className="mt-1 font-display text-[18px] leading-snug tracking-tight text-white">
              {pillar.nome}
            </div>
          </div>
          <span
            aria-hidden
            className="font-mono text-[20px] text-brand-400 transition-all group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => {
            const href = a.href ?? `/artigos/${a.slug}`;
            return (
              <Link
                key={a.slug}
                href={href}
                className="group flex flex-col overflow-hidden border border-line bg-white transition hover:shadow-[0_4px_20px_rgba(10,22,40,0.10)]"
              >
                {a.image && (
                  <div className="relative aspect-[16/10] overflow-hidden bg-navy">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.image}
                      alt={a.title}
                      className="h-full w-full object-cover object-[50%_40%] transition duration-500 group-hover:scale-105"
                    />
                    {a.category && (
                      <span className="absolute left-3 top-3 border border-brand-500/50 bg-navy/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-mono text-brand-400 backdrop-blur-sm">
                        {a.category}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-[18px] leading-snug tracking-tight text-ink group-hover:text-brand-500">
                    {a.title}
                  </h3>
                  {a.excerpt && (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-2">
                      {a.excerpt}
                    </p>
                  )}
                  {(a.date || a.readingTime) && (
                    <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-mono text-ink-2">
                      {a.date && <span>{a.date}</span>}
                      {a.date && a.readingTime && <span>·</span>}
                      {a.readingTime && <span>{a.readingTime}</span>}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
