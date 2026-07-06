"use client";

// Prévia do card de compartilhamento (Open Graph 1200x630), reduzido. Imita o
// card real do WhatsApp/Facebook. Diferente do resto do admin, este preview usa
// o look "Indústria" do site público (navy + brand-500 + font-display) para
// FIDELIDADE ao que o usuário verá compartilhado. doc 05 §6.3.

import { clampTitle } from "@/lib/seo/metadata";

export function OgCardPreview({
  titulo,
  imagem,
  /** domínio exibido no rodapé do card. */
  domain = "natalmaqferramentas.com.br",
}: {
  titulo: string;
  imagem: string | null;
  domain?: string;
}) {
  const title = clampTitle(titulo || "Título do artigo");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Card de compartilhamento
      </h3>

      {/* proporção 1200x630 ≈ 1.91:1 */}
      <div className="overflow-hidden rounded-md border border-zinc-200">
        <div className="relative aspect-[1200/630] w-full bg-navy">
          {imagem ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagem}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-hatch-light" />
          )}

          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <span className="mb-2 block h-px w-10 bg-brand-500" />
            <p className="font-display uppercase leading-[0.95] tracking-tight text-white text-[clamp(16px,4vw,28px)]">
              {title}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white px-4 py-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            {domain}
          </span>
          <span className="font-display text-sm uppercase tracking-tight text-navy">
            Natalmaq
          </span>
        </div>
      </div>
    </div>
  );
}
