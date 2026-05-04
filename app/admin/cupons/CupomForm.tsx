"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Cupom } from "@/types";
import type { CupomFormData } from "./actions";

type Props = {
  cupom?: Cupom;
  onSave: (data: CupomFormData) => Promise<{ ok: boolean; error?: string }>;
};

export function CupomForm({ cupom, onSave }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<CupomFormData>({
    codigo: cupom?.codigo ?? "",
    descricao: cupom?.descricao ?? "",
    tipo: cupom?.tipo ?? "percentual",
    valor: cupom?.valor ?? 10,
    valor_minimo: cupom?.valor_minimo ?? 0,
    usos_max: cupom?.usos_max ?? null,
    ativo: cupom?.ativo ?? true,
    exibir_home: cupom?.exibir_home ?? false,
    validade: cupom?.validade ? cupom.validade.slice(0, 10) : null,
  });

  function update<K extends keyof CupomFormData>(k: K, v: CupomFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const res = await onSave({
        ...form,
        codigo: form.codigo.toUpperCase().trim(),
        validade: form.validade || null,
        usos_max: form.usos_max || null,
      });
      if (res.ok) {
        router.push("/admin/cupons");
        router.refresh();
      } else {
        setErro(res.error ?? "Erro ao salvar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded border border-zinc-200 bg-white p-6 md:grid-cols-2">
        <Field label="Código *">
          <input
            value={form.codigo}
            onChange={(e) => update("codigo", e.target.value.toUpperCase())}
            placeholder="EX: NATAL10"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-zinc-400">Sempre maiúsculo, sem espaços.</p>
        </Field>

        <Field label="Descrição">
          <input
            value={form.descricao ?? ""}
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Ex: 10% para novos clientes"
            className={inputCls}
          />
        </Field>

        <Field label="Tipo de desconto">
          <select
            value={form.tipo}
            onChange={(e) => update("tipo", e.target.value as "percentual" | "fixo")}
            className={inputCls}
          >
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Valor fixo (R$)</option>
          </select>
        </Field>

        <Field label={form.tipo === "percentual" ? "Percentual de desconto (%)" : "Valor do desconto (R$)"}>
          <input
            type="number"
            min={0.01}
            step={form.tipo === "percentual" ? 1 : 0.01}
            value={form.valor}
            onChange={(e) => update("valor", Number(e.target.value))}
            className={inputCls}
          />
        </Field>

        <Field label="Valor mínimo do pedido (R$)">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.valor_minimo}
            onChange={(e) => update("valor_minimo", Number(e.target.value))}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-zinc-400">0 = sem mínimo</p>
        </Field>

        <Field label="Limite de usos">
          <input
            type="number"
            min={1}
            value={form.usos_max ?? ""}
            onChange={(e) => update("usos_max", e.target.value ? Number(e.target.value) : null)}
            placeholder="Deixe vazio para ilimitado"
            className={inputCls}
          />
        </Field>

        <Field label="Validade">
          <input
            type="date"
            value={form.validade ?? ""}
            onChange={(e) => update("validade", e.target.value || null)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-zinc-400">Deixe vazio para sem validade.</p>
        </Field>

        <div className="flex flex-col gap-3 pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => update("ativo", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-zinc-700">Cupom ativo</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.exibir_home}
              onChange={(e) => update("exibir_home", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-zinc-700">Exibir na home</span>
            <span className="text-xs text-zinc-400">(aparece no strip acima dos banners)</span>
          </label>
        </div>
      </div>

      {erro && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar cupom"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/cupons")}
          className="border border-zinc-300 px-6 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
