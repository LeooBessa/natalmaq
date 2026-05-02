"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { uploadParaBucket } from "../_lib/upload";
import { deleteBannerAction, saveBannerAction } from "./actions";

type Banner = {
  id: string;
  titulo: string | null;
  imagem_url: string;
  link: string | null;
  ordem: number;
  ativo: boolean;
  inicia_em: string | null;
  termina_em: string | null;
};

const empty: Banner = {
  id: "",
  titulo: null,
  imagem_url: "",
  link: null,
  ordem: 0,
  ativo: true,
  inicia_em: null,
  termina_em: null,
};

function dateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function BannersManager({ banners }: { banners: Banner[] }) {
  const [editing, setEditing] = useState<Banner>(empty);
  const [imagemUrl, setImagemUrl] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function startEdit(b: Banner) {
    setEditing(b);
    setImagemUrl(b.imagem_url);
    setErro(null);
  }
  function reset() {
    setEditing(empty);
    setImagemUrl("");
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
    else if (r.url) setImagemUrl(r.url);
  }

  function onSubmit(formData: FormData) {
    setErro(null);
    formData.set("imagem_url", imagemUrl);
    if (editing.id) formData.set("id", editing.id);
    startTransition(async () => {
      const r = await saveBannerAction(undefined, formData);
      if (r.error) setErro(r.error);
      else reset();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Apagar este banner?")) return;
    startTransition(async () => {
      const r = await deleteBannerAction(id);
      if (r.error) setErro(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div className="space-y-3">
        {banners.map((b) => (
          <div key={b.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imagem_url} alt="" className="h-16 w-32 rounded object-cover" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{b.titulo ?? <span className="text-zinc-400">— sem título —</span>}</p>
              <p className="truncate text-xs text-zinc-500">{b.link ?? "— sem link —"}</p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                {b.ativo ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">ativo</span>
                ) : (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-semibold text-zinc-700">inativo</span>
                )}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">
                  ordem {b.ordem}
                </span>
                {(b.inicia_em || b.termina_em) && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                    {b.inicia_em ? new Date(b.inicia_em).toLocaleDateString("pt-BR") : "—"}
                    {" → "}
                    {b.termina_em ? new Date(b.termina_em).toLocaleDateString("pt-BR") : "—"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => startEdit(b)} className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand-600">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(b.id)} className="rounded p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Nenhum banner cadastrado.
          </div>
        )}
      </div>

      <form action={onSubmit} className="h-fit space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">{editing.id ? `Editar banner` : "Novo banner"}</h2>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-700">Imagem *</label>
          {imagemUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagemUrl} alt="" className="aspect-[16/6] w-full rounded border border-zinc-200 object-cover" />
              <button
                type="button"
                onClick={() => setImagemUrl("")}
                className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black"
              >
                trocar
              </button>
            </div>
          ) : (
            <label className="flex aspect-[16/6] w-full cursor-pointer items-center justify-center rounded border-2 border-dashed border-zinc-300 text-sm text-zinc-500 hover:border-brand-500">
              {uploading ? "Enviando..." : "Clique para fazer upload"}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>

        <Field label="Título (opcional)">
          <input name="titulo" defaultValue={editing.titulo ?? ""} className={input} key={editing.id + "t"} />
        </Field>
        <Field label="Link ao clicar (ex: /catalogo, /marca/bosch)">
          <input name="link" defaultValue={editing.link ?? ""} className={input} key={editing.id + "l"} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início (opc.)">
            <input type="date" name="inicia_em" defaultValue={dateInputValue(editing.inicia_em)} className={input} key={editing.id + "i"} />
          </Field>
          <Field label="Fim (opc.)">
            <input type="date" name="termina_em" defaultValue={dateInputValue(editing.termina_em)} className={input} key={editing.id + "f"} />
          </Field>
        </div>
        <Field label="Ordem">
          <input type="number" name="ordem" defaultValue={editing.ordem} className={input} key={editing.id + "o"} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={editing.ativo} key={editing.id + "a"} />
          Ativo
        </label>

        {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={pending || !imagemUrl} className="flex-1 rounded-md bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
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
