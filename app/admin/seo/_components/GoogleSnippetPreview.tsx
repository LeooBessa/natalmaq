"use client";

// Prévia do snippet da SERP do Google. Tipografia aproximada do Google:
// breadcrumb url cinza, título azul (~60 char), meta cinza (~160 char). Usa
// clampTitle/clampDescription de lib/seo/metadata para mostrar EXATAMENTE onde o
// Google corta. doc 05 §6.2.

import { clampTitle, clampDescription } from "@/lib/seo/metadata";

export function GoogleSnippetPreview({
  titulo,
  slug,
  description,
  /** segmento do breadcrumb antes do slug (ex.: "artigos", "guias"). */
  pathLabel = "artigos",
  /** domínio exibido no breadcrumb (sem protocolo). */
  domain = "natalmaqferramentas.com.br",
}: {
  titulo: string;
  slug: string;
  description: string;
  pathLabel?: string;
  domain?: string;
}) {
  const title = clampTitle(titulo || "Título do artigo");
  const desc = clampDescription(
    description || "A meta descrição aparece aqui no resultado de busca.",
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Prévia no Google
      </h3>
      <div
        className="max-w-[600px]"
        style={{ fontFamily: "arial, sans-serif" }}
      >
        <div className="flex items-center gap-1 text-xs text-[#202124]">
          <span className="truncate">{domain}</span>
          <span className="text-[#5f6368]">›</span>
          <span className="text-[#5f6368]">{pathLabel}</span>
          <span className="text-[#5f6368]">›</span>
          <span className="truncate text-[#5f6368]">{slug || "slug-do-artigo"}</span>
        </div>
        <p className="mt-0.5 cursor-pointer text-[18px] leading-tight text-[#1a0dab] hover:underline">
          {title}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-[#4d5156]">{desc}</p>
      </div>
    </div>
  );
}
