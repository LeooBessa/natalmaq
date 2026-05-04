"use client";

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
      <div className="flex h-[420px] w-full items-center justify-center border-b border-line bg-navy-800 md:h-[520px]">
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
  const Wrap = banner.link ? Link : "div";

  return (
    <div className="relative w-full overflow-hidden bg-navy">
      {banners.map((b, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={b.id}
          src={b.imagem_url}
          alt={b.titulo ?? ""}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`}
        />
      ))}

      <Wrap
        href={(banner.link ?? "/catalogo") as never}
        className="relative block h-[420px] w-full md:h-[520px]"
        aria-label={banner.titulo ?? "Banner"}
      />

      {banners.length > 1 && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 transition-all ${i === idx ? "w-6 bg-brand-500" : "w-2 bg-white/50 hover:bg-white/80"}`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
