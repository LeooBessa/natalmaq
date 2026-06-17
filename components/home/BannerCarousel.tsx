"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Banner } from "@/types";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) {
    return (
      <div className="flex h-[260px] w-full items-center justify-center border-b border-line bg-navy-800 sm:h-[340px] md:h-[520px]">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-mono text-white/40">
            ESPAÇO PARA BANNERS
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-mono text-white/25">
            Cadastre banners em Admin → Banners
          </div>
        </div>
      </div>
    );
  }

  const banner = banners[idx];
  const isArtigo = banner.link?.startsWith("/artigos/") ?? false;
  const Wrap = banner.link ? Link : "div";

  return (
    <div className="relative w-full overflow-hidden bg-navy">
      {banners.map((b, i) => (
        <Image
          key={b.id}
          src={b.imagem_url}
          alt={b.titulo ?? ""}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`}
        />
      ))}

      <Wrap
        href={(banner.link ?? "/catalogo") as never}
        className="group relative block h-[260px] w-full sm:h-[340px] md:h-[520px]"
        aria-label={banner.titulo ?? "Banner"}
      >
        {isArtigo && (
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-navy/90 via-navy/40 to-transparent">
            <div className="mx-auto w-full max-w-[1280px] px-6 pb-14 md:pb-20">
              <span className="mb-3 inline-block w-fit border border-brand-500/50 bg-navy/40 px-3 py-1 font-mono text-[10px] uppercase tracking-mono text-brand-400 backdrop-blur-sm">
                Artigo
              </span>
              {banner.titulo && (
                <h2 className="max-w-[680px] font-display text-2xl leading-tight tracking-tight text-white md:text-4xl">
                  {banner.titulo}
                </h2>
              )}
              <span className="mt-5 inline-flex w-fit items-center gap-2 bg-brand-500 px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-mono text-white transition-all duration-300 group-hover:gap-3 md:text-[13px]">
                Ler artigo →
              </span>
            </div>
          </div>
        )}
      </Wrap>

      {banners.length > 1 && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Banner ${i + 1}`}
              className="group flex items-center py-3 -my-3"
            >
              <span
                className={`block h-2 transition-all ${i === idx ? "w-6 bg-brand-500" : "w-2 bg-white/50 group-hover:bg-white/80"}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
