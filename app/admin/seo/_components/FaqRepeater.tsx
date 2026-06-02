"use client";

// Repeater de FAQ ({ question, answer }[]) que alimenta o JSON-LD FAQPage do
// artigo público (doc 02). Cartões empilhados com "+ Adicionar pergunta" e
// remover. Ordem natural de criação basta (sem DnD). Controlado: value/onChange.
// doc 05 §5.

import { Plus, Trash2 } from "lucide-react";

import { Field, input } from "./form-ui";

export type FaqItem = { question: string; answer: string };

export function FaqRepeater({
  value,
  onChange,
}: {
  value: FaqItem[];
  onChange: (items: FaqItem[]) => void;
}) {
  function update(i: number, patch: Partial<FaqItem>) {
    onChange(value.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { question: "", answer: "" }]);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900">Perguntas frequentes</h3>

      {value.length === 0 && (
        <p className="rounded-md border-2 border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400">
          Nenhuma pergunta. Adicione 2 ou mais para habilitar o schema FAQPage.
        </p>
      )}

      {value.map((it, i) => (
        <div
          key={i}
          className="space-y-2 rounded-md border border-zinc-200 bg-white p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Field label="Pergunta">
                <input
                  value={it.question}
                  onChange={(e) => update(i, { question: e.target.value })}
                  placeholder="O EPI é obrigatório por lei?"
                  className={input}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-6 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remover pergunta"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <Field label="Resposta">
            <textarea
              value={it.answer}
              onChange={(e) => update(i, { answer: e.target.value })}
              rows={2}
              placeholder="Sim. A NR-6 obriga o fornecimento gratuito..."
              className={input}
            />
          </Field>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
      </button>
    </div>
  );
}
