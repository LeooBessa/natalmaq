"use client";

import { useState } from "react";
import { ZoomIn } from "lucide-react";

type Props = {
  imagens: string[];
  nome: string;
  codigo: string;
};

export function ProdutoGallery({ imagens, nome, codigo }: Props) {
  const [ativa, setAtiva] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (imagens.length === 0) {
    return (
      <div
        className="relative flex aspect-square w-full items-center justify-center border border-line bg-white"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(15,31,61,0.04) 0 1px, transparent 1px 12px)",
        }}
      >
        <div className="flex flex-col items-center gap-2 text-ink-2/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-mono text-[11px] uppercase tracking-mono">
            Imagem não disponível
          </span>
        </div>
        <div className="absolute left-4 top-4 border border-line bg-white px-2 py-1 font-mono text-[11px] uppercase tracking-mono text-ink">
          {codigo}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Imagem principal */}
      <div className="relative">
        <div
          className="group relative aspect-square cursor-zoom-in overflow-hidden border border-line bg-white"
          onClick={() => setLightbox(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={ativa}
            src={imagens[ativa]}
            alt={`${nome} — imagem ${ativa + 1}`}
            className="h-full w-full object-contain p-6 transition duration-300 group-hover:scale-[1.04]"
          />
          <div className="absolute right-3 top-3 rounded-full bg-white/80 p-1.5 text-ink-2 opacity-0 transition group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </div>
          <div className="absolute left-4 top-4 border border-line bg-white px-2 py-1 font-mono text-[11px] uppercase tracking-mono text-ink">
            {codigo}
          </div>
          {imagens.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-navy/70 px-2 py-0.5 font-mono text-[10px] text-white">
              {ativa + 1}/{imagens.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {imagens.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {imagens.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAtiva(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden border-2 bg-white transition ${
                  i === ativa
                    ? "border-navy"
                    : "border-line hover:border-ink-2"
                }`}
                aria-label={`Ver imagem ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Fechar"
            className="absolute right-5 top-5 text-white/70 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Seta anterior */}
          {imagens.length > 1 && ativa > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAtiva((a) => a - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              aria-label="Imagem anterior"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagens[ativa]}
            alt={`${nome} — imagem ${ativa + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Seta próxima */}
          {imagens.length > 1 && ativa < imagens.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAtiva((a) => a + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              aria-label="Próxima imagem"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Contador no lightbox */}
          {imagens.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] text-white/60">
              {ativa + 1} / {imagens.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
