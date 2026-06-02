import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

import { articles, getArticle } from "@/lib/articles";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://natalmaq-main.vercel.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return { title: "Artigo não encontrado | Natalmaq" };
  }

  const url = `/artigos/${article.slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords,
    authors: [{ name: article.author ?? "Equipe Natalmaq" }],
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      type: "article",
      locale: "pt_BR",
      publishedTime: article.isoDate,
      authors: [article.author ?? "Equipe Natalmaq"],
      images: [{ url: article.image }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [article.image],
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const author = article.author ?? "Equipe Natalmaq";
  const articleUrl = `${SITE_URL}/artigos/${article.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        image: article.image,
        datePublished: article.isoDate,
        dateModified: article.isoDate,
        author: { "@type": "Organization", name: author },
        publisher: {
          "@type": "Organization",
          name: "Natalmaq",
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/brand/natalmaq-lockup.png`,
          },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
        articleSection: article.category,
        keywords: article.keywords?.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Artigos", item: `${SITE_URL}/artigos` },
          { "@type": "ListItem", position: 3, name: article.title, item: articleUrl },
        ],
      },
    ],
  };

  return (
    <article className="bg-bone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

        <p className="mb-10 text-lg leading-relaxed text-ink-2">
          {article.excerpt}
        </p>

        {article.content.map((block, i) => {
          if (block.type === "heading") {
            return (
              <h2
                key={i}
                className="mb-4 mt-12 font-display text-2xl tracking-tight text-ink md:text-3xl"
              >
                {block.text}
              </h2>
            );
          }
          if (block.type === "list") {
            return (
              <ul key={i} className="mb-6 space-y-2">
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    className="flex gap-3 text-base leading-relaxed text-ink/80"
                  >
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="mb-4 text-base leading-relaxed text-ink/80">
              {block.text}
            </p>
          );
        })}

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
