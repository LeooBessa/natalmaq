"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { importarPlanilhaAction, type ImportResult } from "./actions";

/**
 * Fluxo:
 *  1. browser → Supabase Storage (upload direto, bypassa o limite de ~4,5 MB
 *     que a Vercel impõe ao corpo de Server Actions)
 *  2. importarPlanilhaAction(path) → o servidor baixa do Storage e processa
 */
export function ImportarForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ImportResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;
    const criarNovos = formData.get("criar_novos") === "on";

    if (!file || file.size === 0) {
      setError("Selecione um arquivo.");
      return;
    }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!["csv", "xlsx", "pdf"].includes(ext)) {
      setError("Formato não suportado. Use CSV, XLSX ou PDF.");
      return;
    }

    try {
      // 1) Upload direto browser → Supabase Storage (bucket `imports`)
      setStage("uploading");
      const sb = createSupabaseBrowserClient();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: errUp } = await sb.storage
        .from("imports")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (errUp) {
        setError("Falha no upload do arquivo: " + errUp.message);
        setStage("idle");
        return;
      }

      // 2) Processamento server-side (baixa do Storage e importa)
      setStage("processing");
      const result = await importarPlanilhaAction({
        storage_path: path,
        filename: file.name,
        criar_novos: criarNovos,
      });
      setState(result);
      setStage("idle");
      if (result.ok) router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setStage("idle");
    }
  }

  const pending = stage !== "idle";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6"
    >
      <h2 className="font-semibold">Selecionar planilha</h2>

      <div>
        <input
          type="file"
          name="file"
          required
          disabled={pending}
          accept=".csv,.xlsx,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-700 disabled:opacity-60"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="criar_novos" disabled={pending} />
        Criar produtos novos automaticamente quando o código não existir
      </label>

      <p className="text-xs text-zinc-500">
        O upload vai direto para o Storage, sem o limite de tamanho da Vercel.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {stage === "uploading"
          ? "Enviando arquivo…"
          : stage === "processing"
            ? "Processando…"
            : "Importar"}
      </button>

      {stage === "uploading" && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          📤 Enviando arquivo para o Storage…
        </div>
      )}
      {stage === "processing" && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚙️ Processando o arquivo… Não feche essa aba.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {state && (
        <div className="mt-4 space-y-2">
          {state.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : (
            <div className="rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
              <p className="font-semibold">Importação concluída.</p>
              <p>
                {state.atualizados} atualizados • {state.inseridos} inseridos
                {state.variantes ? ` • ${state.variantes} variantes vinculadas` : ""} •{" "}
                {state.erros?.length ?? 0} erros (em {state.total} linhas)
              </p>
            </div>
          )}
          {state.erros && state.erros.length > 0 && (
            <details className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">
                Ver erros ({state.erros.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {state.erros.slice(0, 100).map((e, i) => (
                  <li key={i} className="font-mono text-xs">
                    Linha {e.linha}{e.codigo ? ` (${e.codigo})` : ""}: {e.motivo}
                  </li>
                ))}
                {state.erros.length > 100 && (
                  <li className="italic text-zinc-500">
                    ...e mais {state.erros.length - 100} erros.
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
