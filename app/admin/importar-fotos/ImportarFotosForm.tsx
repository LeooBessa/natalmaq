"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { processarPdfFornecedorAction, type ProcessarResult } from "./actions";
import type { Marca } from "@/types";

export function ImportarFotosForm({ marcas }: { marcas: Marca[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ProcessarResult | undefined,
    FormData
  >(async (_prev, formData) => processarPdfFornecedorAction(formData), undefined);

  useEffect(() => {
    if (state && state.ok) {
      router.push(`/admin/importar-fotos/${state.id}` as never);
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
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
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
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
            accept=".pdf,application/pdf"
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-700"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        O processamento leva ~30 segundos para PDFs de até 300 páginas. Não
        feche essa aba.
      </p>

      {state && !state.ok && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Processando..." : "Processar PDF"}
      </button>
    </form>
  );
}
