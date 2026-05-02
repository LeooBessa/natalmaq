"use client";

import { useActionState } from "react";

import { importarPlanilhaAction, type ImportResult } from "./actions";

export function ImportarForm() {
  const [state, formAction, pending] = useActionState<
    ImportResult | undefined,
    FormData
  >(importarPlanilhaAction, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="font-semibold">Selecionar planilha</h2>

      <div>
        <input
          type="file"
          name="file"
          required
          accept=".csv,.xlsx,.pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-brand-700"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="criar_novos" />
        Criar produtos novos automaticamente quando o código não existir
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Processando..." : "Importar"}
      </button>

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
