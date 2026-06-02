"use client";

// Repeater de HowTo ({ name, steps: { name, text }[] } | null) que alimenta o
// JSON-LD HowTo do artigo público (doc 02). A ORDEM dos passos importa, então há
// setas ↑/↓ (sem DnD, conforme doc 05 §5). O HowTo todo é opcional: enquanto for
// null, mostra só o botão de habilitar; ao habilitar, vira um objeto com 1 passo.
// Controlado: value/onChange.

import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

import { Field, input } from "./form-ui";

export type HowToStep = { name: string; text: string };
export type HowToValue = { name: string; steps: HowToStep[] } | null;

export function HowToRepeater({
  value,
  onChange,
}: {
  value: HowToValue;
  onChange: (v: HowToValue) => void;
}) {
  if (value === null) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">Passo a passo (HowTo)</h3>
        <button
          type="button"
          onClick={() => onChange({ name: "", steps: [{ name: "", text: "" }] })}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Plus className="h-3.5 w-3.5" /> Gerar schema HowTo
        </button>
      </div>
    );
  }

  function setName(name: string) {
    onChange({ ...value!, name });
  }
  function updateStep(i: number, patch: Partial<HowToStep>) {
    onChange({
      ...value!,
      steps: value!.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  }
  function removeStep(i: number) {
    onChange({ ...value!, steps: value!.steps.filter((_, idx) => idx !== i) });
  }
  function addStep() {
    onChange({ ...value!, steps: [...value!.steps, { name: "", text: "" }] });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value!.steps.length) return;
    const steps = [...value!.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    onChange({ ...value!, steps });
  }
  function disable() {
    onChange(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Passo a passo (HowTo)</h3>
        <button
          type="button"
          onClick={disable}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          Remover schema
        </button>
      </div>

      <Field label="Nome do passo a passo">
        <input
          value={value.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como escolher o EPI por etapa"
          className={input}
        />
      </Field>

      <div className="space-y-2">
        {value.steps.map((s, i) => (
          <div
            key={i}
            className="space-y-2 rounded-md border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {i + 1}
              </span>
              <input
                value={s.name}
                onChange={(e) => updateStep(i, { name: e.target.value })}
                placeholder="Título do passo"
                className={`${input} flex-1`}
              />
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.steps.length - 1}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover passo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <textarea
              value={s.text}
              onChange={(e) => updateStep(i, { text: e.target.value })}
              rows={2}
              placeholder="Descrição do passo"
              className={input}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addStep}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar passo
      </button>
    </div>
  );
}
