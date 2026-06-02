"use client";

// Revisão de links internos sugeridos (molde direto de RevisaoList.tsx):
// aceitar/rejeitar por item + atalho "Aceitar todos de alta confiança", com Set
// de resolvidos. As sugestões vêm de uma server action (criada no estágio de
// artigos) que roda buildInternalLinks no servidor. Este componente NÃO faz I/O:
// recebe a lista e devolve as decisões via onChange (aceitos/rejeitados).
// doc 05 §7 / doc 03.

import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";

export type LinkSugestao = {
  blockIndex: number;
  anchor: string;
  href: string;
  tipo: "produto" | "categoria" | "marca" | "artigo";
  /** 0..100 — confiança da sugestão (badge colorido). */
  confianca: number;
  /** opcional: trecho do parágrafo para contexto na revisão. */
  trecho?: string;
};

export type LinkDecisions = {
  aceitos: LinkSugestao[];
  rejeitados: LinkSugestao[];
};

// Chave estável de uma sugestão (uma âncora por bloco para um destino).
function keyOf(s: LinkSugestao): string {
  return `${s.blockIndex}|${s.anchor}|${s.href}`;
}

const TIPO_LABEL: Record<LinkSugestao["tipo"], string> = {
  produto: "produto",
  categoria: "categoria",
  marca: "marca",
  artigo: "artigo",
};

// Mesma lógica de cor do enriquecimento (scoreCor), faixas de confiança.
function confiancaCor(c: number): string {
  if (c >= 70) return "bg-emerald-100 text-emerald-700";
  if (c >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}
function confiancaLabel(c: number): string {
  if (c >= 70) return "alta";
  if (c >= 40) return "média";
  return "baixa";
}

const ALTA_CONFIANCA = 70;

export function InternalLinksReview({
  sugestoes,
  onChange,
}: {
  sugestoes: LinkSugestao[];
  /** chamado a cada decisão com as listas atuais de aceitos/rejeitados. */
  onChange?: (decisions: LinkDecisions) => void;
}) {
  // Mapa key → decisão. Ausente = pendente.
  const [decisoes, setDecisoes] = useState<Map<string, "aceito" | "rejeitado">>(
    new Map(),
  );

  const byKey = useMemo(() => {
    const m = new Map<string, LinkSugestao>();
    for (const s of sugestoes) m.set(keyOf(s), s);
    return m;
  }, [sugestoes]);

  function emit(next: Map<string, "aceito" | "rejeitado">) {
    setDecisoes(next);
    if (!onChange) return;
    const aceitos: LinkSugestao[] = [];
    const rejeitados: LinkSugestao[] = [];
    for (const [k, v] of next) {
      const s = byKey.get(k);
      if (!s) continue;
      if (v === "aceito") aceitos.push(s);
      else rejeitados.push(s);
    }
    onChange({ aceitos, rejeitados });
  }

  function decidir(s: LinkSugestao, decisao: "aceito" | "rejeitado") {
    const next = new Map(decisoes);
    next.set(keyOf(s), decisao);
    emit(next);
  }

  function aceitarAltaConfianca() {
    const next = new Map(decisoes);
    for (const s of sugestoes) {
      const k = keyOf(s);
      if (!next.has(k) && s.confianca >= ALTA_CONFIANCA) next.set(k, "aceito");
    }
    emit(next);
  }

  const pendentes = sugestoes.filter((s) => !decisoes.has(keyOf(s)));
  const temAlta = pendentes.some((s) => s.confianca >= ALTA_CONFIANCA);

  if (sugestoes.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Links internos sugeridos</h3>
        <p className="mt-2 text-xs text-zinc-400">
          Nenhuma sugestão de link interno para este conteúdo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Links internos sugeridos ({pendentes.length})
        </h3>
        {temAlta && (
          <button
            type="button"
            onClick={aceitarAltaConfianca}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Aceitar todos de alta confiança
          </button>
        )}
      </div>

      {pendentes.length === 0 ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Todas as sugestões foram revisadas.
        </p>
      ) : (
        <ul className="space-y-2">
          {pendentes.map((s) => (
            <li
              key={keyOf(s)}
              className="rounded-md border border-zinc-200 p-3"
            >
              {s.trecho && (
                <p className="mb-2 text-xs text-zinc-500">
                  …{s.trecho}…
                </p>
              )}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-800">
                  {s.anchor}
                </span>
                <span className="text-xs text-zinc-400">→</span>
                <span className="truncate font-mono text-xs text-brand-600">
                  {s.href}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">{TIPO_LABEL[s.tipo]}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${confiancaCor(s.confianca)}`}
                  >
                    {confiancaLabel(s.confianca)}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => decidir(s, "aceito")}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" /> Aceitar
                  </button>
                  <button
                    type="button"
                    onClick={() => decidir(s, "rejeitado")}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
