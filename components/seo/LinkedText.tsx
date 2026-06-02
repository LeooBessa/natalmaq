// Renderiza um trecho de texto RAW (parágrafo ou item de lista) inserindo
// <Link> nos spans calculados pelo motor de linkagem interna (doc 03 §6.1).
//
// RSC puro (sem "use client", sem dangerouslySetInnerHTML): monta os nós React a
// partir dos offsets [start, end) de cada InlineLink. Os offsets são no texto RAW
// e raw.slice(start, end) === anchor (garantido pelo motor). Recebe APENAS os
// links daquele bloco/item — o caller agrupa InlineLink[] por blockIndex+itemIndex.

import Link from "next/link";

import type { InlineLink } from "@/lib/seo/internal-links";

interface LinkedTextProps {
  /** texto RAW do bloco/item (preserva caixa/acento). */
  text: string;
  /** links SÓ deste bloco/item (já filtrados pelo caller). */
  links: InlineLink[];
}

const ANCHOR_CLASS =
  "text-brand-600 underline decoration-brand-500/30 underline-offset-2 hover:decoration-brand-500";

export function LinkedText({ text, links }: LinkedTextProps) {
  // Sem links: retorna o texto cru (caminho rápido / fallback seguro).
  if (!links || links.length === 0) return <>{text}</>;

  // Ordena por offset e descarta spans inválidos/sobrepostos (defensivo: o motor
  // já garante não-overlap, mas o render nunca deve quebrar por dado ruim).
  const ordered = [...links]
    .filter(
      (l) =>
        Number.isInteger(l.start) &&
        Number.isInteger(l.end) &&
        l.start >= 0 &&
        l.end <= text.length &&
        l.start < l.end,
    )
    .sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const l of ordered) {
    if (l.start < cursor) continue; // overlap com o anterior: ignora
    if (l.start > cursor) {
      // texto puro antes do link
      nodes.push(text.slice(cursor, l.start));
    }
    const anchor = text.slice(l.start, l.end);
    nodes.push(
      <Link
        key={`${l.start}-${l.end}-${l.target.href}`}
        href={l.target.href}
        className={ANCHOR_CLASS}
      >
        {anchor}
      </Link>,
    );
    cursor = l.end;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor)); // cauda

  return <>{nodes}</>;
}
