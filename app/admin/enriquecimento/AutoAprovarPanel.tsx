"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Pause } from "lucide-react";

import { autoAprovarLote } from "./actions";

export function AutoAprovarPanel() {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [processados, setProcessados] = useState(0);
  const [aprovados, setAprovados] = useState(0);
  const [reprovados, setReprovados] = useState(0);
  const [fim, setFim] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pararRef = useRef(false);

  async function rodar() {
    setErro(null);
    setRodando(true);
    setFim(false);
    setProcessados(0);
    setAprovados(0);
    setReprovados(0);
    pararRef.current = false;
    let cur: string | null = null;
    let proc = 0;
    let apr = 0;
    let rep = 0;
    while (!pararRef.current) {
      const r = await autoAprovarLote(cur);
      if (!r.ok) {
        setErro(r.error ?? "Erro ao auto-aprovar.");
        break;
      }
      cur = r.ultimoId;
      proc += r.processados;
      apr += r.aprovados;
      rep += r.reprovados;
      setProcessados(proc);
      setAprovados(apr);
      setReprovados(rep);
      if (r.fim) {
        setFim(true);
        break;
      }
    }
    setRodando(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-900">Auto-aprovar (imagem única)</h2>
          <p className="max-w-2xl text-sm text-zinc-600">
            <strong>Reprova</strong> os candidatos cuja foto se repete em vários
            produtos (match genérico) e <strong>aprova</strong> os de foto única com
            boa compatibilidade. Tudo o que for aprovado aparece em{" "}
            <strong>Revisão</strong> abaixo pra você conferir e corrigir o que
            estiver errado.
          </p>
        </div>
        <div className="flex gap-2">
          {!rodando && (
            <button
              type="button"
              onClick={rodar}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Sparkles className="h-4 w-4" />
              Auto-aprovar
            </button>
          )}
          {rodando && (
            <button
              type="button"
              onClick={() => (pararRef.current = true)}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <Pause className="h-4 w-4" />
              Pausar
            </button>
          )}
        </div>
      </div>

      {(rodando || processados > 0) && (
        <p className="mt-3 text-sm text-zinc-600">
          {processados.toLocaleString("pt-BR")} analisados ·{" "}
          <strong className="text-emerald-700">{aprovados} aprovados</strong> ·{" "}
          <strong className="text-red-600">{reprovados} reprovados</strong>
          <span className="text-zinc-400"> (genéricos)</span>
          {rodando ? " · processando…" : fim ? " · concluído ✓" : ""}
        </p>
      )}
      {erro && (
        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
    </div>
  );
}
