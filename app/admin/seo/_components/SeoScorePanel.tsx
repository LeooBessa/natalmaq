"use client";

// Painel de SEO Score ao vivo (coluna direita do editor, sticky). 100% client e
// determinístico: chama scoreArtigo (lib/seo/score, função PURA) com debounce de
// ~300ms para não recalcular a cada keystroke. Mostra o número 0-100 (anel +
// badge colorido com helper scoreCor, mesmo do enriquecimento) + checklist
// ✓/⚠/✗ com hint. doc 02 §6 / doc 05 §6.1.

import { Check, AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { ArticleBlock } from "@/lib/articles";
import { scoreArtigo, type SeoCheck } from "@/lib/seo/score";

export type SeoScoreInput = {
  titulo: string;
  excerpt: string;
  keywords: string[];
  conteudo: ArticleBlock[];
  imagemAlt?: string;
  slug: string;
  faq?: { question: string; answer: string }[];
};

// Mesma lógica de cor do enriquecimento (RevisaoList.scoreCor), faixas de SEO.
function scoreCor(score: number): { badge: string; ring: string; text: string } {
  if (score >= 80)
    return {
      badge: "bg-emerald-100 text-emerald-700",
      ring: "text-emerald-500",
      text: "text-emerald-600",
    };
  if (score >= 50)
    return {
      badge: "bg-amber-100 text-amber-700",
      ring: "text-amber-500",
      text: "text-amber-600",
    };
  return {
    badge: "bg-red-100 text-red-700",
    ring: "text-red-500",
    text: "text-red-600",
  };
}

export function SeoScorePanel({ input }: { input: SeoScoreInput }) {
  const [result, setResult] = useState(() => scoreArtigo(input));

  // Recalcula com debounce ~300ms a cada mudança dos campos.
  useEffect(() => {
    const t = setTimeout(() => setResult(scoreArtigo(input)), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { score, checks } = result;
  const cor = scoreCor(score);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">SEO Score</h3>
        <ScoreRing score={score} cor={cor} />
      </div>

      <ul className="space-y-1.5">
        {checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>
    </div>
  );
}

function ScoreRing({
  score,
  cor,
}: {
  score: number;
  cor: { ring: string; text: string };
}) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative h-12 w-12">
      <svg viewBox="0 0 40 40" className="h-12 w-12 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          className="text-zinc-200"
          stroke="currentColor"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={cor.ring}
          stroke="currentColor"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${cor.text}`}
      >
        {score}
      </span>
    </div>
  );
}

function CheckRow({ check }: { check: SeoCheck }) {
  // ok=true → ✓ verde. ok=false com hint → ⚠ âmbar. ok=false sem hint → ✗ vermelho.
  const variant: "ok" | "warn" | "fail" = check.ok
    ? "ok"
    : check.hint
      ? "warn"
      : "fail";

  const Icon = variant === "ok" ? Check : variant === "warn" ? AlertTriangle : X;
  const iconCls =
    variant === "ok"
      ? "text-emerald-500"
      : variant === "warn"
        ? "text-amber-500"
        : "text-red-500";

  return (
    <li className="flex items-start gap-2" title={check.hint ?? ""}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} />
      <div className="min-w-0">
        <span className={`text-xs ${check.ok ? "text-zinc-700" : "text-zinc-900"}`}>
          {check.label}
        </span>
        {!check.ok && check.hint && (
          <span className="block text-[11px] text-zinc-400">{check.hint}</span>
        )}
      </div>
    </li>
  );
}
