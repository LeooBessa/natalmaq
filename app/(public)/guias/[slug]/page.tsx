import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";

import { getCluster, listClusters, listArtigosByCluster } from "@/lib/conteudo";
import { buildWaLinkLoja } from "@/lib/whatsapp";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbNode,
  collectionNode,
  faqNode,
  storeNode,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { ClusterIndex, type ClusterIndexItem } from "@/components/seo/ClusterIndex";

export const revalidate = 600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Best-effort: sem a migration 0019, listClusters() -> [] e não pré-renderiza
// nada estaticamente (rotas geradas sob demanda). Nunca quebra.
export async function generateStaticParams() {
  const clusters = await listClusters();
  return clusters.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cluster = await getCluster(slug);

  if (!cluster) {
    return { title: "Guia não encontrado" };
  }

  return buildMetadata({
    title: cluster.metaTitle ?? cluster.title,
    description:
      cluster.metaDescription ??
      cluster.subtitle ??
      cluster.intro ??
      cluster.title,
    path: `/guias/${cluster.slug}`,
    type: "website",
    noindex: cluster.noindex,
  });
}

export default async function GuiaPillarPage({ params }: PageProps) {
  const { slug } = await params;
  const cluster = await getCluster(slug);

  if (!cluster) {
    notFound();
  }

  const satelites = await listArtigosByCluster(cluster.slug);

  const indexItems: ClusterIndexItem[] = satelites.map((a) => ({
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
  }));

  const orcamentoLink = buildWaLinkLoja(
    `Olá! Vi o guia "${cluster.title}" no site da Natalmaq e quero montar um orçamento.`,
  );

  const path = `/guias/${cluster.slug}`;

  // JSON-LD: CollectionPage (ItemList dos satélites — MESMA lista do ClusterIndex)
  // + BreadcrumbList + FAQPage (se houver) + Store/LocalBusiness.
  const jsonLd = [
    collectionNode({
      name: cluster.title,
      description: cluster.metaDescription ?? cluster.subtitle ?? undefined,
      path,
      items: satelites.map((a) => ({
        name: a.title,
        path: `/artigos/${a.slug}`,
      })),
    }),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Guias", path: "/guias" },
      { name: cluster.title, path },
    ]),
    faqNode(cluster.faq ?? []),
    storeNode(),
  ].filter(Boolean) as object[];

  return (
    <div className="bg-bone">
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <header className="border-b border-line bg-navy">
        <div className="mx-auto max-w-3xl px-6 py-14 md:py-20">
          <div className="font-mono text-[11px] uppercase tracking-mono text-brand-400">
            NATALMAQ / GUIA COMPLETO
          </div>
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight text-white md:text-[44px]">
            {cluster.title}
          </h1>
          {cluster.subtitle && (
            <p className="mt-4 max-w-[640px] text-lg leading-relaxed text-white/70 md:text-xl">
              {cluster.subtitle}
            </p>
          )}
        </div>
      </header>

      {/* Corpo */}
      <div className="mx-auto max-w-3xl px-6 py-14 md:py-16">
        {cluster.intro && (
          <p className="text-lg leading-relaxed text-ink/80 md:text-xl">
            {cluster.intro}
          </p>
        )}

        {/* Índice dos satélites (materializa o ItemList) */}
        <ClusterIndex items={indexItems} />

        {/* FAQ */}
        {cluster.faq && cluster.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 font-display text-2xl tracking-tight text-ink md:text-[34px]">
              Perguntas frequentes
            </h2>
            <div className="space-y-6">
              {cluster.faq.map((item, i) => (
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

        {/* CTA — monte seu orçamento */}
        <section className="mt-14 border border-line bg-white p-8 md:p-10">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            PRECISA EQUIPAR SUA OPERAÇÃO?
          </div>
          <h2 className="mt-2 font-display text-2xl leading-tight tracking-tight text-ink md:text-3xl">
            Monte seu orçamento com a Natalmaq
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-ink-2 md:text-lg">
            Fale com nossa equipe pelo WhatsApp ou monte sua cesta no catálogo.
            Atendimento técnico e nota fiscal para empresas em todo o RN.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={orcamentoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-brand-500 px-6 py-3 font-mono text-[12px] font-semibold uppercase tracking-mono text-white transition hover:bg-brand-600"
            >
              <MessageCircle size={16} />
              Orçamento no WhatsApp
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
            href="/guias"
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-mono text-brand-500 transition-all duration-300 hover:gap-3"
          >
            <ArrowLeft size={16} />
            Voltar para os guias
          </Link>
        </div>
      </div>
    </div>
  );
}
