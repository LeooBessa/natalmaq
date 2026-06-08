"use client";

import { useRef, useState, useTransition } from "react";
import { Check, RefreshCw, Trash2 } from "lucide-react";

import { uploadDireto } from "@/lib/supabase/upload-client";
import {
  confirmarEnriquecimento,
  confirmarVarios,
  removerEnriquecimentoAprovado,
  trocarImagemEnriquecimento,
} from "./actions";

export type Auditado = {
  id: string;
  titulo: string | null;
  score: number;
  produto: {
    id: string;
    codigo: string;
    nome: string;
    imagens: string[] | null;
  } | null;
};

export function RevisaoAprovados({ itens }: { itens: Auditado[] }) {
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());
  const [confirmandoTodos, startTodos] = useTransition();
  const visiveis = itens.filter((i) => !resolvidos.has(i.id));

  if (visiveis.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-500">
        Nada para revisar. Auto-aprovados conferidos aparecem aqui.
      </p>
    );
  }

  function confirmarTodos() {
    const ids = visiveis.map((v) => v.id);
    startTodos(async () => {
      const r = await confirmarVarios(ids);
      if (r.ok) {
        setResolvidos((s) => {
          const n = new Set(s);
          ids.forEach((id) => n.add(id));
          return n;
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {visiveis.length} nesta tela · remova (🗑) os errados e confirme o resto.
        </p>
        <button
          type="button"
          onClick={confirmarTodos}
          disabled={confirmandoTodos}
          className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {confirmandoTodos ? "Confirmando…" : `Confirmar todos os visíveis (${visiveis.length})`}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {visiveis.map((a) => (
          <AuditCard
            key={a.id}
            a={a}
            onResolvido={() => setResolvidos((s) => new Set(s).add(a.id))}
          />
        ))}
      </div>
    </div>
  );
}

function AuditCard({ a, onResolvido }: { a: Auditado; onResolvido: () => void }) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const img = a.produto?.imagens?.[0];
  const ocupado = pending || uploading;

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarEnriquecimento(a.id);
      if (r.ok) onResolvido();
      else setErro(r.error ?? "Erro.");
    });
  }

  function remover() {
    setErro(null);
    startTransition(async () => {
      const r = await removerEnriquecimentoAprovado(a.id);
      if (r.ok) onResolvido();
      else setErro(r.error ?? "Erro.");
    });
  }

  async function trocar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setUploading(true);
    const up = await uploadDireto("produtos", file);
    setUploading(false);
    e.target.value = "";
    if (up.error || !up.url) {
      setErro(up.error ?? "Falha no upload.");
      return;
    }
    const url = up.url;
    startTransition(async () => {
      const r = await trocarImagemEnriquecimento(a.id, url);
      if (r.ok) onResolvido();
      else setErro(r.error ?? "Erro.");
    });
  }

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white p-3">
      <div className="relative mb-2 aspect-square overflow-hidden rounded-md border border-zinc-100 bg-zinc-50">
        {img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={img} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            sem imagem
          </div>
        )}
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {a.score.toFixed(0)}%
        </span>
      </div>

      <p className="font-mono text-[11px] text-zinc-400">{a.produto?.codigo ?? "—"}</p>
      <p className="line-clamp-2 text-xs font-medium text-zinc-800">
        {a.produto?.nome ?? "(produto removido)"}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">ML: {a.titulo ?? "—"}</p>

      {erro && <p className="mt-1 text-[11px] text-red-600">{erro}</p>}

      <div className="mt-2 grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={confirmar}
          disabled={ocupado}
          title="Confirmar — a foto está certa"
          className="flex items-center justify-center rounded bg-emerald-600 py-1.5 text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={ocupado}
          title="Trocar imagem (enviar do computador)"
          className="flex items-center justify-center rounded border border-zinc-300 py-1.5 text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${uploading ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={remover}
          disabled={ocupado}
          title="Remover foto (estava errada)"
          className="flex items-center justify-center rounded border border-red-200 py-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={trocar}
      />
    </div>
  );
}
