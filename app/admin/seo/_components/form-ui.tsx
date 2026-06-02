"use client";

// Primitivas de formulário compartilhadas pelas telas de Conteúdo/SEO.
// Espelham 1:1 o <Field> + classe `input` do ProdutoForm/MarcasManager para os
// editores SEO reusarem sem duplicar markup. Design ADMIN (limpo): bg-white,
// border-zinc-300, foco brand-500. (doc 05 §4.)

import type { ReactNode } from "react";

/** Classe Tailwind compartilhada de input/textarea/select (idêntica ao ProdutoForm). */
export const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function Field({
  label,
  htmlFor,
  children,
  className,
  hint,
}: {
  label: string;
  /** Opcional: se passado, vira <label htmlFor> (associa a um input com esse id). */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

/**
 * Textarea com contador de caracteres ao vivo (ex.: meta description 0/160).
 * Cor do contador: verde quando dentro de [min,max], âmbar quando abaixo de min,
 * vermelho quando acima de max. Componente CONTROLADO (value/onChange).
 */
export function MetaCounter({
  value,
  onChange,
  max,
  min = 0,
  name,
  id,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  /** Limite inferior recomendado (abaixo dele o contador fica âmbar). */
  min?: number;
  /** Opcional: cria um <input type="hidden" name> com o valor (para forms server action). */
  name?: string;
  id?: string;
  rows?: number;
  placeholder?: string;
}) {
  const len = value.length;
  const cor =
    len > max
      ? "text-red-600"
      : len < min
        ? "text-amber-600"
        : "text-emerald-600";

  return (
    <div className="space-y-1">
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={input}
      />
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex items-center justify-end">
        <span className={`text-xs font-semibold tabular-nums ${cor}`}>
          {len}/{max}
        </span>
      </div>
    </div>
  );
}
