import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, MessageCircle } from "lucide-react";

import { getLanding, listLandings } from "@/lib/conteudo";
import { listProdutosByIds } from "@/lib/data";
import { buildWaLinkLoja } from "@/lib/whatsapp";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbNode,
  collectionNode,
  faqNode,
  serviceNode,
  storeNode,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedProducts } from "@/components/seo/RelatedProducts";
import type { ProdutoComMarca } from "@/types";

export const revalidate = 600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Best-effort: sem a migration 0019, listLandings() -> [] e as rotas são geradas
// sob demanda. Nunca quebra.
export async function generateStaticParams() {
  const landings = await listLandings();
  return landings.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getLanding(slug);

  if (!landing) {
    return { title: "Solução não encontrada" };
  }

  return buildMetadata({
    title: landing.metaTitle ?? landing.title,
    description:
      landing.metaDescription ?? landing.subtitle ?? landing.title,
    path: `/solucoes/${landing.slug}`,
    image: landing.heroImage ?? undefined,
    type: "website",
    noindex: landing.noindex,
  });
}

export default async function SolucaoLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const landing = await getLanding(slug);

  if (!landing) {
    notFound();
  }

  // Vitrine de produtos em destaque (curados por id). Best-effort: erro/ausência
  // -> [] e a seção simplesmente não aparece.
  let vitrine: ProdutoComMarca[] = [];
  if (landing.produtosDestaque && landing.produtosDestaque.length > 0) {
    try {
      vitrine = await listProdutosByIds(landing.produtosDestaque);
    } catch {
      vitrine = [];
    }
  }

  const local = [landing.cidade, landing.uf].filter(Boolean).join("/");
  const path = `/solucoes/${landing.slug}`;

  const ctaMsg = `Olá! Vi a página "${landing.title}" no site da Natalmaq e quero solicitar um orçamento.`;
  const ctaLink = buildWaLinkLoja(ctaMsg);

  // JSON-LD: Store/LocalBusiness + Service + FAQPage + BreadcrumbList
  // + (CollectionPage se houver vitrine).
  const jsonLd = [
    storeNode(),
    serviceNode({
      name: landing.title,
      description:
        landing.metaDescription ?? landing.subtitle ?? landing.title,
      path,
      areaServed: landing.uf === "RN" ? "Rio Grande do Norte" : undefined,
    }),
    faqNode(landing.faq ?? []),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Soluções", path: "/solucoes" },
      { name: landing.title, path },
    ]),
    vitrine.length > 0
      ? collectionNode({
          name: `${landing.title} — produtos em destaque`,
          path,
          items: vitrine.map((p) => ({
            name: p.nome,
            path: `/produto/${p.slug}`,
          })),
        })
      : null,
  ].filter(Boolean) as object[];

  return (
    <div className="bg-bone">
      <JsonLd data={jsonLd} />

      {/* Hero + CTA WhatsApp */}
      <header className="relative overflow-hidden border-b border-line bg-navy">
        {landing.heroImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={landing.heroImage}
              alt={landing.title}
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-navy/60" />
          </>
        )}
        <div className="relative mx-auto max-w-3xl px-4 md:px-6 py-16 md:py-24">
          {local && (
            <span className="inline-flex items-center gap-1.5 border border-brand-500/50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-mono text-brand-400">
              <MapPin size={11} />
              {local}
            </span>
          )}
          <h1 className="mt-4 font-display text-3xl leading-tight tracking-tight text-white md:text-[46px]">
            {landing.title}
          </h1>
          {landing.subtitle && (
            <p className="mt-4 max-w-[640px] text-lg leading-relaxed text-white/75 md:text-xl">
              {landing.subtitle}
            </p>
          )}
          <div className="mt-8">
            <a
              href={ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-brand-500 px-6 py-3.5 font-mono text-[12px] font-semibold uppercase tracking-mono text-white transition hover:bg-brand-600"
            >
              <MessageCircle size={16} />
              Solicitar orçamento no WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Corpo */}
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-14 md:py-16">
        {landing.content.map((block, i) => {
          if (block.type === "heading") {
            return (
              <h2
                key={i}
                className="mb-4 mt-12 font-display text-2xl tracking-tight text-ink first:mt-0 md:text-[34px]"
              >
                {block.text}
              </h2>
            );
          }
          if (block.type === "list") {
            return (
              <ul key={i} className="mb-7 space-y-3">
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    className="flex gap-3 text-lg leading-relaxed text-ink/80 md:text-xl"
                  >
                    <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p
              key={i}
              className="mb-5 text-lg leading-relaxed text-ink/80 md:text-xl"
            >
              {block.text}
            </p>
          );
        })}

        {/* Vitrine de produtos em destaque */}
        {vitrine.length > 0 && (
          <RelatedProducts produtos={vitrine} titulo="Produtos em destaque" />
        )}

        {/* FAQ */}
        {landing.faq && landing.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 font-display text-2xl tracking-tight text-ink md:text-[34px]">
              Perguntas frequentes
            </h2>
            <div className="space-y-6">
              {landing.faq.map((item, i) => (
                <div key={i} className="border-t border-line pt-6">
                  <h3 className="mb-2 font-display text-lg tracking-tight text-ink">
                    {item.question}
                  </h3>
                  <p className="text-lg leading-relaxed text-ink/80 md:text-xl">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="mt-14 border border-line bg-white p-8 md:p-10">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            VAMOS FECHAR NEGÓCIO?
          </div>
          <h2 className="mt-2 font-display text-2xl leading-tight tracking-tight text-ink md:text-3xl">
            Peça seu orçamento agora
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-ink-2 md:text-lg">
            Atendimento direto pelo WhatsApp, nota fiscal e entrega
            {landing.uf === "RN" ? " em todo o Rio Grande do Norte" : ""}.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-brand-500 px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-mono text-white transition hover:bg-brand-600"
            >
              <MessageCircle size={16} />
              Falar no WhatsApp
            </a>
            <Link
              href="/catalogo"
              className="inline-flex items-center justify-center gap-2 border border-line px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-mono text-ink transition hover:border-brand-500/50 hover:text-brand-500"
            >
              Ver catálogo
            </Link>
          </div>
        </section>

        <div className="mt-12 border-t border-line pt-8">
          <Link
            href="/solucoes"
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-mono text-brand-500 transition-all duration-300 hover:gap-3"
          >
            <ArrowLeft size={16} />
            Voltar para as soluções
          </Link>
        </div>
      </div>
    </div>
  );
}
