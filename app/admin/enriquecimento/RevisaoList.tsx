"use client";

import { useState, useTransition } from "react";
import { Check, X, ExternalLink } from "lucide-react";

import { formatBRL } from "@/lib/format";
import { aprovarEnriquecimento, rejeitarEnriquecimento } from "./actions";

export type Candidato = {
  id: string;
  titulo: string | null;
  imagem_url: string;
  url_origem: string | null;
  preco_origem: number | null;
  score: number;
  produto: {
    id: string;
    codigo: string;
    nome: string;
    imagens: string[] | null;
  } | null;
};

export function RevisaoList({ itens }: { itens: Candidato[] }) {
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());

  const visiveis = itens.filter((i) => !resolvidos.has(i.id));

  function marcarResolvido(id: string) {
    setResolvidos((s) => new Set(s).add(id));
  }

  if (visiveis.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white px-5 py-12 text-center text-zinc-500">
        Nenhum candidato pendente nesta página.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {visiveis.map((c) => (
        <CandidatoCard key={c.id} c={c} onResolvido={() => marcarResolvido(c.id)} />
      ))}
    </div>
  );
}

function scoreCor(score: number) {
  if (score >= 60) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function CandidatoCard({
  c,
  onResolvido,
}: {
  c: Candidato;
  onResolvido: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function aprovar() {
    setErro(null);
    startTransition(async () => {
      const r = await aprovarEnriquecimento(c.id);
      if (r.ok) onResolvido();
      else setErro(r.error ?? "Erro ao aprovar.");
    });
  }

  function rejeitar() {
    setErro(null);
    startTransition(async () => {
      const r = await rejeitarEnriquecimento(c.id);
      if (r.ok) onResolvido();
      else setErro(r.error ?? "Erro ao rejeitar.");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex gap-4">
        {/* Foto candidata */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.imagem_url}
          alt={c.titulo ?? "Candidato"}
          className="h-28 w-28 shrink-0 rounded-md border border-zinc-200 object-contain"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreCor(c.score)}`}>
              {c.score.toFixed(0)}% match
            </span>
            {c.preco_origem != null && (
              <span className="text-xs text-zinc-500">
                ML: {formatBRL(Number(c.preco_origem))}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-zinc-900 line-clamp-2">
            {c.titulo ?? "—"}
          </p>
          {c.url_origem && (
            <a
              href={c.url_origem}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              ver no Mercado Livre <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Produto do catálogo */}
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs">
        <span className="font-mono text-zinc-400">{c.produto?.codigo ?? "—"}</span>
        <span className="ml-2 text-zinc-700">{c.produto?.nome ?? "(produto removido)"}</span>
      </div>

      {erro && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={aprovar}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {pending ? "..." : "Aprovar"}
        </button>
        <button
          type="button"
          onClick={rejeitar}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Rejeitar
        </button>
      </div>
    </div>
  );
}
