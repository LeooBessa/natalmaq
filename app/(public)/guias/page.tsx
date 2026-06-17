import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { listClusters } from "@/lib/conteudo";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, collectionNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

// ISR: conteúdo mora no Supabase; revalida sem deploy. Best-effort: se a migration
// 0019 não estiver aplicada, listClusters() retorna [] e a página mostra o estado
// "Em breve" — nunca quebra.
export const revalidate = 600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Guias",
    description:
      "Guias completos sobre ferramentas, máquinas, EPI e segurança no trabalho. Conteúdo técnico da Natalmaq para profissionais e empresas em Natal/RN.",
    path: "/guias",
  });
}

export default async function GuiasIndexPage() {
  const clusters = await listClusters();

  const jsonLd = [
    collectionNode({
      name: "Guias",
      description:
        "Hub de guias completos da Natalmaq sobre ferramentas, máquinas, EPI e segurança no trabalho.",
      path: "/guias",
      items: clusters.map((c) => ({
        name: c.title,
        path: `/guias/${c.slug}`,
      })),
    }),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Guias", path: "/guias" },
    ]),
  ];

  return (
    <div className="bg-bone">
      <JsonLd data={jsonLd} />

      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-10">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / GUIAS
          </div>
          <h1 className="mt-2 font-display text-[32px] leading-tight tracking-tight text-ink md:text-[44px]">
            Guias <span className="text-brand-500">completos</span>
          </h1>
          <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-ink-2 md:text-lg">
            Conteúdo técnico, direto ao ponto, para escolher, usar e cuidar das
            ferramentas, máquinas e EPI da sua operação.
          </p>
        </div>
      </div>

      {/* Grid de pillars */}
      <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-10">
        {clusters.length === 0 ? (
          <div className="border border-line bg-white px-6 py-16 text-center">
            <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
              EM BREVE
            </div>
            <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-ink-2">
              Os guias estão sendo preparados. Enquanto isso, confira os{" "}
              <Link
                href="/artigos"
                className="text-brand-600 underline decoration-brand-500/30 underline-offset-2 hover:decoration-brand-500"
              >
                nossos artigos
              </Link>{" "}
              ou explore o{" "}
              <Link
                href="/catalogo"
                className="text-brand-600 underline decoration-brand-500/30 underline-offset-2 hover:decoration-brand-500"
              >
                catálogo completo
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {clusters.map((cluster) => (
              <Link
                key={cluster.slug}
                href={`/guias/${cluster.slug}`}
                className="group flex h-full flex-col border border-line bg-white p-6 transition hover:border-brand-500/50 hover:shadow-[0_4px_20px_rgba(10,22,40,0.10)]"
              >
                <span className="mb-4 inline-flex w-fit items-center gap-1.5 border border-brand-500/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-mono text-brand-500">
                  Guia
                </span>
                <h2 className="font-display text-[20px] leading-snug tracking-tight text-ink group-hover:text-brand-500">
                  {cluster.title}
                </h2>
                {cluster.subtitle && (
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-2">
                    {cluster.subtitle}
                  </p>
                )}
                <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-mono text-brand-500 transition-all group-hover:gap-2.5">
                  Ler guia
                  <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
