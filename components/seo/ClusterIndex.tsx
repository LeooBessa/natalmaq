// Índice dos artigos satélite na página do pillar (/guias/{slug}). RSC.
//
// Lista de cards/links que materializa o ItemList do cluster (o caller espelha a
// mesma lista no JSON-LD via collectionNode/ItemList). Recebe os artigos satélite
// JÁ resolvidos ({ title, slug, excerpt? }). Cada item linka para /artigos/{slug}.
// Não renderiza nada se a lista vier vazia.

import Link from "next/link";

/** Item do índice do cluster (artigo satélite). */
export interface ClusterIndexItem {
  title: string;
  slug: string;
  excerpt?: string;
  /** href opcional; default /artigos/{slug}. */
  href?: string;
}

interface ClusterIndexProps {
  items: ClusterIndexItem[];
  titulo?: string;
}

export function ClusterIndex({
  items,
  titulo = "Neste guia",
}: ClusterIndexProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-6 font-mono text-[12px] font-bold uppercase tracking-mono text-ink-2">
        {titulo}
      </h2>
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item, i) => {
          const href = item.href ?? `/artigos/${item.slug}`;
          return (
            <li key={item.slug}>
              <Link
                href={href}
                className="group flex h-full gap-4 border border-line bg-white p-5 transition hover:border-brand-500/50 hover:shadow-[0_4px_20px_rgba(10,22,40,0.08)]"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-brand-500/50 font-mono text-sm font-semibold text-brand-500">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-[17px] leading-snug tracking-tight text-ink group-hover:text-brand-500">
                    {item.title}
                  </h3>
                  {item.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-2">
                      {item.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
