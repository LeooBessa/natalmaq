"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { deleteCategoriaAction, saveCategoriaAction } from "./actions";

type Categoria = {
  id: string;
  nome: string;
  slug: string;
  parent_id: string | null;
  ordem: number;
};

const empty: Categoria = {
  id: "",
  nome: "",
  slug: "",
  parent_id: null,
  ordem: 0,
};

export function CategoriasManager({ categorias }: { categorias: Categoria[] }) {
  const [editing, setEditing] = useState<Categoria>(empty);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function startEdit(c: Categoria) {
    setEditing(c);
    setErro(null);
  }
  function reset() {
    setEditing(empty);
    setErro(null);
  }

  function onSubmit(formData: FormData) {
    setErro(null);
    if (editing.id) formData.set("id", editing.id);
    startTransition(async () => {
      const r = await saveCategoriaAction(undefined, formData);
      if (r.error) setErro(r.error);
      else reset();
    });
  }

  function handleDelete(id: string, nome: string) {
    if (!confirm(`Apagar categoria "${nome}"?`)) return;
    startTransition(async () => {
      const r = await deleteCategoriaAction(id);
      if (r.error) setErro(r.error);
    });
  }

  const map = new Map(categorias.map((c) => [c.id, c.nome]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Pai</th>
              <th className="px-4 py-2 text-right">Ordem</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="px-4 py-2 font-medium">{c.nome}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-500">{c.slug}</td>
                <td className="px-4 py-2 text-zinc-500">{c.parent_id ? map.get(c.parent_id) ?? "—" : "—"}</td>
                <td className="px-4 py-2 text-right">{c.ordem}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => startEdit(c)} className="mr-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-brand-600" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id, c.nome)} className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600" aria-label="Apagar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {categorias.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Nenhuma categoria.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={onSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 h-fit">
        <h2 className="font-semibold">{editing.id ? `Editar: ${editing.nome}` : "Nova categoria"}</h2>
        <Field label="Nome *">
          <input name="nome" defaultValue={editing.nome} required className={input} key={editing.id + "n"} />
        </Field>
        <Field label="Slug">
          <input name="slug" defaultValue={editing.slug} placeholder="auto" className={input} key={editing.id + "s"} />
        </Field>
        <Field label="Categoria pai (opcional)">
          <select name="parent_id" defaultValue={editing.parent_id ?? ""} className={input} key={editing.id + "p"}>
            <option value="">— sem pai —</option>
            {categorias.filter((c) => c.id !== editing.id).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Field>
        <Field label="Ordem">
          <input type="number" name="ordem" defaultValue={editing.ordem} className={input} key={editing.id + "o"} />
        </Field>

        {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={pending} className="flex-1 rounded-md bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {pending ? "Salvando..." : editing.id ? "Salvar" : "Criar"}
          </button>
          {editing.id && (
            <button type="button" onClick={reset} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

const input = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      {children}
    </label>
  );
}
