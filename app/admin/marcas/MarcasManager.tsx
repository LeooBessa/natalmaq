"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { uploadParaBucket } from "../_lib/upload";
import { deleteMarcaAction, saveMarcaAction } from "./actions";

type Marca = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  ordem: number;
  ativo: boolean;
};

const empty: Marca = {
  id: "",
  nome: "",
  slug: "",
  logo_url: null,
  ordem: 0,
  ativo: true,
};

export function MarcasManager({ marcas }: { marcas: Marca[] }) {
  const [editing, setEditing] = useState<Marca>(empty);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function startEdit(m: Marca) {
    setEditing(m);
    setLogoUrl(m.logo_url);
    setErro(null);
  }

  function reset() {
    setEditing(empty);
    setLogoUrl(null);
    setErro(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await uploadParaBucket("marketing", fd);
    setUploading(false);
    e.target.value = "";
    if (r.error) setErro(r.error);
    else if (r.url) setLogoUrl(r.url);
  }

  function onSubmit(formData: FormData) {
    setErro(null);
    if (logoUrl) formData.set("logo_url", logoUrl);
    if (editing.id) formData.set("id", editing.id);
    startTransition(async () => {
      const r = await saveMarcaAction(undefined, formData);
      if (r.error) setErro(r.error);
      else reset();
    });
  }

  function handleDelete(id: string, nome: string) {
    if (!confirm(`Apagar marca "${nome}"? Os produtos vinculados não serão apagados.`)) return;
    startTransition(async () => {
      const r = await deleteMarcaAction(id);
      if (r.error) setErro(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Lista */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Logo</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2 text-right">Ordem</th>
              <th className="px-4 py-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {marcas.map((m) => (
              <tr key={m.id} className="border-t border-zinc-100">
                <td className="px-4 py-2">
                  {m.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-medium">{m.nome}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-500">{m.slug}</td>
                <td className="px-4 py-2 text-right">{m.ordem}</td>
                <td className="px-4 py-2">
                  {m.ativo ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">ativo</span>
                  ) : (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">inativo</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => startEdit(m)}
                    className="mr-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-brand-600"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id, m.nome)}
                    className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Apagar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {marcas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Nenhuma marca cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form */}
      <form
        action={onSubmit}
        className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 h-fit"
      >
        <h2 className="font-semibold">
          {editing.id ? `Editar: ${editing.nome}` : "Nova marca"}
        </h2>
        <Field label="Nome *">
          <input name="nome" defaultValue={editing.nome} required className={input} key={editing.id + "n"} />
        </Field>
        <Field label="Slug">
          <input name="slug" defaultValue={editing.slug} placeholder="auto" className={input} key={editing.id + "s"} />
        </Field>
        <Field label="Ordem">
          <input type="number" name="ordem" defaultValue={editing.ordem} className={input} key={editing.id + "o"} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={editing.ativo} key={editing.id + "a"} />
          Ativa
        </label>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-700">Logo</label>
          {logoUrl && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="h-12 w-12 rounded border border-zinc-200 object-contain" />
              <button type="button" onClick={() => setLogoUrl(null)} className="text-xs text-red-600 hover:underline">
                remover
              </button>
            </div>
          )}
          <label className="inline-block cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50">
            {uploading ? "Enviando..." : logoUrl ? "Trocar" : "+ Upload logo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {erro && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Salvando..." : editing.id ? "Salvar" : "Criar"}
          </button>
          {editing.id && (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      {children}
    </label>
  );
}
