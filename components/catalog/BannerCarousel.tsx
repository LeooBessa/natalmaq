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

  if (banners.length === 0) return null;
  const atual = banners[idx];

  const slide = (
    <div className="relative aspect-[16/6] w-full overflow-hidden rounded-lg bg-zinc-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={atual.imagem_url}
        alt={atual.titulo ?? ""}
        className="h-full w-full object-cover"
      />
      {atual.titulo && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-6">
          <h2 className="text-2xl font-bold text-white drop-shadow md:text-4xl">
            {atual.titulo}
          </h2>
        </div>
      )}
      {banners.length > 1 && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? "w-6 bg-white" : "w-2 bg-white/60"
              }`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return atual.link ? (
    <Link href={atual.link as never}>{slide}</Link>
  ) : (
    slide
  );
}
