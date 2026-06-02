"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Article } from "@/lib/articles";

export function ArticlesCarousel({ articles }: { articles: Article[] }) {
  const [index, setIndex] = useState(0);
  const count = articles.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(next, 7000);
    return () => clearInterval(timer);
  }, [next, count]);

  if (count === 0) return null;

  return (
    <section id="artigos" className="bg-bone">
      {/* Heading */}
      <div className="mx-auto max-w-[1280px] px-6 pt-12 pb-8 md:pt-16">
        <h2 className="font-display text-3xl leading-tight tracking-tight text-ink md:text-5xl">
          Últimos <span className="text-brand-500">artigos</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2 md:text-lg">
          Dicas e guias sobre ferramentas, EPI e manutenção para o seu dia a dia.
        </p>
      </div>

      {/* Carrossel */}
      <div className="relative h-[260px] w-full overflow-hidden bg-navy md:h-[560px]">
        {articles.map((article, i) => (
          <div
            key={article.slug}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={i !== index}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image}
              alt={article.title}
              className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
            />
            {/* Gradiente para legibilidade do texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />

            <div className="relative mx-auto flex h-full max-w-[1280px] flex-col justify-end px-6 pb-12 md:pb-16">
              <span className="mb-3 inline-block w-fit border border-brand-500/50 bg-navy/40 px-3 py-1 font-mono text-[10px] uppercase tracking-mono text-brand-400 backdrop-blur-sm">
                {article.category}
              </span>
              <h3 className="max-w-[680px] font-display text-2xl leading-tight tracking-tight text-white md:text-4xl">
                {article.title}
              </h3>
              <Link
                href={`/artigos/${article.slug}`}
                className="mt-5 inline-flex w-fit items-center gap-2 bg-brand-500 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-mono text-white transition-all duration-300 hover:gap-3 hover:bg-brand-400 md:text-[13px]"
              >
                Ler artigo →
              </Link>
            </div>
          </div>
        ))}

        {count > 1 && (
          <>
            {/* Setas */}
            <button
              onClick={prev}
              aria-label="Artigo anterior"
              className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-all duration-300 hover:border-brand-400 hover:bg-black/60 md:left-6"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              aria-label="Próximo artigo"
              className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-all duration-300 hover:border-brand-400 hover:bg-black/60 md:right-6"
            >
              <ChevronRight size={22} />
            </button>

            {/* Paginação */}
            <div className="absolute bottom-6 left-0 right-0 z-20">
              <div className="mx-auto flex max-w-[1280px] gap-2 px-6">
                {articles.map((a, i) => (
                  <button
                    key={a.slug}
                    onClick={() => setIndex(i)}
                    aria-label={`Ir para o artigo ${i + 1}`}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === index ? "w-9 bg-brand-500" : "w-5 bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
