"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  criarImportFotosAction,
  processarImportFotosAction,
} from "./actions";
import type { Marca } from "@/types";

/**
 * Fluxo em 3 passos:
 *  1. criarImportFotosAction → cria registro + retorna importId + upload path
 *  2. browser → Supabase Storage (PUT direto, bypassa Vercel 4.5MB limit)
 *  3. processarImportFotosAction(importId) → server baixa do Storage,
 *     extrai imagens/produtos, atualiza status
 */
export function ImportarFotosForm({ marcas }: { marcas: Marca[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<
    "idle" | "uploading" | "processing" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;
    const marcaId = formData.get("marca_id") as string;
    if (!file || !marcaId) {
      setError("Preencha marca e arquivo");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Apenas PDF é aceito");
      return;
    }

    try {
      // 1) Cria registro + obtém path de upload
      setStage("uploading");
      setProgress(0);
      const created = await criarImportFotosAction({
        marca_id: marcaId,
        arquivo_pdf: file.name,
      });
      if (!created.ok) {
        setError(created.error);
        setStage("error");
        return;
      }

      // 2) Upload direto browser → Supabase Storage
      const sb = createSupabaseBrowserClient();
      const { error: errUp } = await sb.storage
        .from("fotos-import")
        .upload(created.upload_path, file, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (errUp) {
        setError("Falha no upload: " + errUp.message);
        setStage("error");
        return;
      }
      setProgress(100);

      // 3) Dispara processamento server-side
      setStage("processing");
      const processed = await processarImportFotosAction(created.id);
      if (!processed.ok) {
        setError(processed.error);
        setStage("error");
        return;
      }

      router.push(`/admin/importar-fotos/${created.id}` as never);
    } catch (err) {
      setError((err as Error).message);
      setStage("error");
    }
  }

  const pending = stage === "uploading" || stage === "processing";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6"
    >
      <h2 className="font-semibold">Novo upload</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-700">
            Marca *
          </span>
          <select
            name="marca_id"
            required
            disabled={pending}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">Selecione a marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-700">
            PDF do catálogo *
          </span>
          <input
            type="file"
            name="file"
            required
            disabled={pending}
            accept=".pdf,application/pdf"
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-700 disabled:opacity-60"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        O upload vai direto para o Storage (não há limite de tamanho da Vercel).
        Depois o servidor processa o PDF — pode levar ~30-60s.
      </p>

      {stage === "uploading" && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          📤 Enviando arquivo para o Storage…
        </div>
      )}
      {stage === "processing" && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚙️ Processando o PDF (extraindo imagens e descrições)… Não feche essa
          aba.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {stage === "uploading"
          ? "Enviando…"
          : stage === "processing"
            ? "Processando…"
            : "Enviar PDF"}
      </button>
    </form>
  );
}
