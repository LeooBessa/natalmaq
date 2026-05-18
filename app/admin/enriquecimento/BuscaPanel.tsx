"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Pause, RotateCcw } from "lucide-react";

import { processarLoteEnriquecimento } from "./actions";

export function BuscaPanel({ totalSemFoto }: { totalSemFoto: number }) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [processados, setProcessados] = useState(0);
  const [candidatos, setCandidatos] = useState(0);
  const [fim, setFim] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pararRef = useRef(false);

  useEffect(() => {
    const c = localStorage.getItem("enriq_cursor");
    const p = Number(localStorage.getItem("enriq_processados") || 0);
    if (c) setCursor(c);
    if (p) setProcessados(p);
    if (localStorage.getItem("enriq_fim") === "1") setFim(true);
  }, []);

  async function rodar() {
    setErro(null);
    setRodando(true);
    pararRef.current = false;
    let cur = cursor;
    let proc = processados;
    let cand = candidatos;

    while (!pararRef.current) {
      const r = await processarLoteEnriquecimento(cur);
      if (!r.ok) {
        setErro(r.error ?? "Erro ao processar o lote.");
        break;
      }
      cur = r.ultimoId;
      proc += r.processados;
      cand += r.comCandidato;
      setCursor(cur);
      setProcessados(proc);
      setCandidatos(cand);
      localStorage.setItem("enriq_cursor", cur ?? "");
      localStorage.setItem("enriq_processados", String(proc));
      if (r.fim) {
        setFim(true);
        localStorage.setItem("enriq_fim", "1");
        break;
      }
    }
    setRodando(false);
    router.refresh();
  }

  function pausar() {
    pararRef.current = true;
  }

  function recomecar() {
    localStorage.removeItem("enriq_cursor");
    localStorage.removeItem("enriq_processados");
    localStorage.removeItem("enriq_fim");
    setCursor(null);
    setProcessados(0);
    setCandidatos(0);
    setFim(false);
    setErro(null);
  }

  const pct = totalSemFoto > 0 ? Math.min(100, Math.round((processados / totalSemFoto) * 100)) : 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-900">Buscar candidatos no Mercado Livre</h2>
          <p className="text-sm text-zinc-500">
            Percorre os {totalSemFoto.toLocaleString("pt-BR")} produtos sem foto e
            busca foto + título no catálogo do ML.
          </p>
        </div>
        <div className="flex gap-2">
          {!fim && !rodando && (
            <button
              type="button"
              onClick={rodar}
              className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Search className="h-4 w-4" />
              {processados > 0 ? "Continuar busca" : "Iniciar busca"}
            </button>
          )}
          {rodando && (
            <button
              type="button"
              onClick={pausar}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <Pause className="h-4 w-4" />
              Pausar
            </button>
          )}
          {(fim || (processados > 0 && !rodando)) && (
            <button
              type="button"
              onClick={recomecar}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50"
            >
              <RotateCcw className="h-4 w-4" />
              Recomeçar
            </button>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
          <span>
            {processados.toLocaleString("pt-BR")} de {totalSemFoto.toLocaleString("pt-BR")} processados ({pct}%)
          </span>
          {candidatos > 0 && <span>{candidatos} candidatos nesta sessão</span>}
        </div>
      </div>

      {rodando && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚙️ Buscando… mantenha esta aba aberta. Pode pausar e continuar depois —
          o progresso é salvo.
        </p>
      )}
      {fim && !rodando && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          ✓ Busca concluída. Revise os candidatos abaixo.
        </p>
      )}
      {erro && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
    </div>
  );
}
