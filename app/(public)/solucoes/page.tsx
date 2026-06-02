import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

import { listLandings } from "@/lib/conteudo";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, collectionNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Soluções",
    description:
      "Soluções de fornecimento de ferramentas, máquinas e EPI para empresas em Natal/RN: compra com CNPJ, distribuidor industrial e atendimento B2B com nota fiscal.",
    path: "/solucoes",
  });
}

export default async function SolucoesIndexPage() {
  const landings = await listLandings();

  const jsonLd = [
    collectionNode({
      name: "Soluções",
      description:
        "Soluções B2B e locais da Natalmaq para empresas no Rio Grande do Norte.",
      path: "/solucoes",
      items: landings.map((l) => ({
        name: l.title,
        path: `/solucoes/${l.slug}`,
      })),
    }),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Soluções", path: "/solucoes" },
    ]),
  ];

  return (
    <div className="bg-bone">
      <JsonLd data={jsonLd} />

      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / SOLUÇÕES
          </div>
          <h1 className="mt-2 font-display text-[32px] leading-tight tracking-tight text-ink md:text-[44px]">
            Soluções <span className="text-brand-500">para empresas</span>
          </h1>
          <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-ink-2 md:text-lg">
            Compra com CNPJ, fornecimento industrial e atendimento B2B com nota
            fiscal e entrega em todo o Rio Grande do Norte.
          </p>
        </div>
      </div>

      {/* Grid de landings */}
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        {landings.length === 0 ? (
          <div className="border border-line bg-white px-6 py-16 text-center">
            <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
              EM BREVE
            </div>
            <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-ink-2">
              Nossas páginas de soluções estão a caminho. Enquanto isso, fale com
              a gente pelo{" "}
              <a
                href="https://wa.me/558430259789"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline decoration-brand-500/30 underline-offset-2 hover:decoration-brand-500"
              >
                WhatsApp
              </a>{" "}
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
            {landings.map((landing) => {
              const local = [landing.cidade, landing.uf]
                .filter(Boolean)
                .join("/");
              return (
                <Link
                  key={landing.slug}
                  href={`/solucoes/${landing.slug}`}
                  className="group flex h-full flex-col border border-line bg-white p-6 transition hover:border-brand-500/50 hover:shadow-[0_4px_20px_rgba(10,22,40,0.10)]"
                >
                  {local && (
                    <span className="mb-4 inline-flex w-fit items-center gap-1.5 border border-brand-500/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-mono text-brand-500">
                      <MapPin size={11} />
                      {local}
                    </span>
                  )}
                  <h2 className="font-display text-[20px] leading-snug tracking-tight text-ink group-hover:text-brand-500">
                    {landing.title}
                  </h2>
                  {landing.subtitle && (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-2">
                      {landing.subtitle}
                    </p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-mono text-brand-500 transition-all group-hover:gap-2.5">
                    Saiba mais
                    <ArrowUpRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
