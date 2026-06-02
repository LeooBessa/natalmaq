import type { Metadata } from "next";
import Link from "next/link";

import { listArtigos } from "@/lib/conteudo";
import { breadcrumbNode, collectionNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Artigos",
  description:
    "Dicas e guias sobre ferramentas, EPI, manutenção e segurança no trabalho — conteúdo da Natalmaq para profissionais da construção e indústria.",
  alternates: { canonical: "/artigos" },
};

export const revalidate = 60;

export default async function ArtigosIndexPage() {
  const articles = await listArtigos();

  const jsonLd = [
    collectionNode({
      name: "Artigos",
      path: "/artigos",
      items: articles.map((a) => ({
        name: a.title,
        path: `/artigos/${a.slug}`,
      })),
    }),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Artigos", path: "/artigos" },
    ]),
  ];

  return (
    <div className="bg-bone">
      <JsonLd data={jsonLd} />
      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / ARTIGOS
          </div>
          <h1 className="mt-2 font-display text-[32px] leading-tight tracking-tight text-ink md:text-[44px]">
            Últimos <span className="text-brand-500">artigos</span>
          </h1>
          <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-ink-2 md:text-lg">
            Dicas e guias sobre ferramentas, EPI e manutenção para o seu dia a dia.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/artigos/${article.slug}`}
              className="group flex flex-col overflow-hidden border border-line bg-white transition hover:shadow-[0_4px_20px_rgba(10,22,40,0.10)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-navy">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image}
                  alt={article.title}
                  className="h-full w-full object-cover object-[50%_40%] transition duration-500 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 border border-brand-500/50 bg-navy/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-mono text-brand-400 backdrop-blur-sm">
                  {article.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-[18px] leading-snug tracking-tight text-ink group-hover:text-brand-500">
                  {article.title}
                </h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-2">
                  {article.excerpt}
                </p>
                <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-mono text-ink-2">
                  <span>{article.date}</span>
                  <span>·</span>
                  <span>{article.readingTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
