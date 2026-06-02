import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

import { getArtigo, listArtigos } from "@/lib/conteudo";
import { getProdutoBySlug } from "@/lib/data";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  articleNode,
  breadcrumbNode,
  faqNode,
  howToNode,
  storeNode,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { LinkedText } from "@/components/seo/LinkedText";
import { RelatedSection } from "@/components/seo/RelatedSection";
import type { LeiaTambemArticle } from "@/components/seo/LeiaTambem";
import {
  buildDictionary,
  buildInternalLinks,
  type InlineLink,
} from "@/lib/seo/internal-links";
import type { ProdutoComMarca } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const artigos = await listArtigos();
  return artigos.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArtigo(slug);

  if (!article) {
    return { title: "Artigo não encontrado" };
  }

  return buildMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/artigos/${article.slug}`,
    image: article.image,
    type: "article",
    publishedTime: article.isoDate,
    modifiedTime: article.isoDate,
    authorName: article.author,
    keywords: article.keywords,
  });
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArtigo(slug);

  if (!article) {
    notFound();
  }

  // ---------------------------------------------------------------------------
  // Linkagem interna (render-time, cacheada — NÃO materializa no banco aqui).
  //
  // A persistência em artigos.links_inline/relacionados é Fase 3 (no save do
  // admin, via buildInternalLinksFull + persistLinks). Aqui rodamos o motor em
  // tempo de render: buildDictionary() é cacheado por request (React cache) e
  // buildInternalLinks é síncrono/puro. Usamos a variante síncrona (leiaTambem/
  // pillar vêm vazios dela) e completamos o "Leia também" abaixo, best-effort.
  // Tudo é tolerante a falha: se algo der erro, o bloco é simplesmente omitido
  // e o artigo continua renderizando idêntico ao de hoje.
  // ---------------------------------------------------------------------------
  const dict = await buildDictionary();
  const result = buildInternalLinks(
    {
      slug: article.slug,
      titulo: article.title,
      keywords: article.keywords ?? [],
      cluster: article.cluster,
      content: article.content,
    },
    dict,
  );

  // Índice de InlineLink por blockIndex|itemIndex p/ o render passar a cada
  // <LinkedText> SÓ os links daquele bloco/item (chave "b" ou "b:it").
  const linksByBlock = new Map<string, InlineLink[]>();
  for (const l of result.inline) {
    const key = l.itemIndex === undefined ? `${l.blockIndex}` : `${l.blockIndex}:${l.itemIndex}`;
    const arr = linksByBlock.get(key);
    if (arr) arr.push(l);
    else linksByBlock.set(key, [l]);
  }
  const linksFor = (blockIndex: number, itemIndex?: number): InlineLink[] =>
    linksByBlock.get(
      itemIndex === undefined ? `${blockIndex}` : `${blockIndex}:${itemIndex}`,
    ) ?? [];

  // Resolve o RelatedBundle (LinkTarget[]) em dados renderizáveis. Produtos
  // viram ProdutoComMarca (lib/data por slug) p/ alimentar o ProductCard;
  // categorias/marcas já têm nome+href (chips). leiaTambem é resolvido em
  // LeiaTambemArticle via os artigos já carregados (listArtigos). Best-effort:
  // qualquer falha vira lista vazia e o sub-bloco se omite sozinho.
  let produtosRelacionados: ProdutoComMarca[] = [];
  try {
    const resolvidos = await Promise.all(
      result.related.produtos.map((t) =>
        getProdutoBySlug(t.slug).catch(() => null),
      ),
    );
    // getProdutoBySlug devolve ProdutoComMarca + variantes/complementares; o
    // RelatedProducts só precisa de ProdutoComMarca (supertipo), então filtramos
    // os nulos e estreitamos para o tipo que o ProductCard consome.
    produtosRelacionados = resolvidos.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );
  } catch {
    produtosRelacionados = [];
  }

  // leiaTambem: a variante síncrona do motor devolve [] aqui; resolvemos via os
  // artigos já listados (mesmo cluster primeiro), excluindo o próprio. Mantém
  // custo zero (uma leitura cacheada de listArtigos) e nunca quebra.
  let leiaTambem: LeiaTambemArticle[] = [];
  try {
    const todos = await listArtigos();
    const candidatos = todos.filter((a) => a.slug !== article.slug);
    const mesmoCluster = article.cluster
      ? candidatos.filter((a) => a.cluster === article.cluster)
      : [];
    const ordenados = [
      ...mesmoCluster,
      ...candidatos.filter((a) => !mesmoCluster.includes(a)),
    ].slice(0, 3);
    leiaTambem = ordenados.map((a) => ({
      slug: a.slug,
      title: a.title,
      href: `/artigos/${a.slug}`,
      category: a.category,
      excerpt: a.excerpt,
      image: a.image,
      date: a.date,
      readingTime: a.readingTime,
    }));
  } catch {
    leiaTambem = [];
  }

  const jsonLd = [
    articleNode(article),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Artigos", path: "/artigos" },
      { name: article.title, path: `/artigos/${article.slug}` },
    ]),
    faqNode(article.faq ?? []),
    howToNode(article.howto),
    storeNode(),
  ].filter(Boolean) as object[];

  return (
    <article className="bg-bone">
      <JsonLd data={jsonLd} />
      {/* Hero — só imagem */}
      <header className="relative h-[260px] w-full overflow-hidden bg-navy md:h-[560px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.image}
          alt={article.title}
          className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
        />
      </header>

      {/* Corpo */}
      <div className="mx-auto max-w-3xl px-6 py-14 md:py-20">
        <span className="mb-4 inline-block border border-brand-500/50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-mono text-brand-500">
          {article.category}
        </span>
        <h1 className="mb-4 font-display text-3xl leading-tight tracking-tight text-ink md:text-4xl">
          {article.title}
        </h1>
        <div className="mb-10 flex flex-wrap items-center gap-5 text-sm text-ink-2">
          <span className="flex items-center gap-2">
            <Calendar size={15} />
            {article.date}
          </span>
          <span className="flex items-center gap-2">
            <Clock size={15} />
            {article.readingTime}
          </span>
        </div>

        <p className="mb-10 text-xl leading-relaxed text-ink-2 md:text-2xl">
          {article.excerpt}
        </p>

        {article.content.map((block, i) => {
          if (block.type === "heading") {
            return (
              <h2
                key={i}
                className="mb-4 mt-12 font-display text-2xl tracking-tight text-ink md:text-[34px]"
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
                    <span>
                      <LinkedText text={item} links={linksFor(i, j)} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="mb-5 text-lg leading-relaxed text-ink/80 md:text-xl">
              <LinkedText text={block.text} links={linksFor(i)} />
            </p>
          );
        })}

        {/* Passo a passo (HowTo) */}
        {article.howto && article.howto.steps.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 font-display text-2xl tracking-tight text-ink md:text-[34px]">
              {article.howto.name}
            </h2>
            <ol className="space-y-5">
              {article.howto.steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-brand-500/50 font-mono text-sm font-semibold text-brand-500">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="mb-1 font-display text-lg tracking-tight text-ink">
                      {step.name}
                    </h3>
                    <p className="text-lg leading-relaxed text-ink/80 md:text-xl">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Perguntas frequentes (FAQ) */}
        {article.faq && article.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 font-display text-2xl tracking-tight text-ink md:text-[34px]">
              Perguntas frequentes
            </h2>
            <div className="space-y-6">
              {article.faq.map((item, i) => (
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

        {/* Relacionados (produtos -> categorias/marcas -> leia também).
            Render-time, best-effort: cada sub-bloco se omite se vier vazio. */}
        <div className="mt-14">
          <RelatedSection
            produtos={produtosRelacionados}
            categorias={result.related.categorias}
            marcas={result.related.marcas}
            leiaTambem={leiaTambem}
            pillar={result.related.pillar}
          />
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <Link
            href="/institucional#artigos"
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-mono text-brand-500 transition-all duration-300 hover:gap-3"
          >
            <ArrowLeft size={16} />
            Voltar para os artigos
          </Link>
        </div>
      </div>
    </article>
  );
}
