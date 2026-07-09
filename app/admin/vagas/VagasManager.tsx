"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Trash2, ImagePlus } from "lucide-react";

import { uploadDireto } from "@/lib/supabase/upload-client";
import type { Vaga } from "@/types";
import {
  criarBannerDaVagaAction,
  deleteVagaAction,
  saveVagaAction,
} from "./actions";

const empty: Vaga = {
  id: "",
  titulo: "",
  descricao: "",
  tipo: null,
  local: null,
  ativo: true,
  ordem: 0,
  criado_em: "",
};

export function VagasManager({ vagas }: { vagas: Vaga[] }) {
  const [editing, setEditing] = useState<Vaga>(empty);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function startEdit(v: Vaga) {
    setEditing(v);
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
      const r = await saveVagaAction(undefined, formData);
      if (r.error) setErro(r.error);
      else reset();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Apagar esta vaga?")) return;
    startTransition(async () => {
      const r = await deleteVagaAction(id);
      if (r.error) setErro(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-3">
        {vagas.map((v) => (
          <VagaRow key={v.id} v={v} onEdit={() => startEdit(v)} onDelete={() => handleDelete(v.id)} />
        ))}
        {vagas.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Nenhuma vaga cadastrada. Crie uma no formulário ao lado — as ativas
            aparecem em “Trabalhe conosco” no institucional.
          </div>
        )}
      </div>

      <form action={onSubmit} className="h-fit space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">{editing.id ? "Editar vaga" : "Nova vaga"}</h2>

        <Field label="Título *">
          <input name="titulo" defaultValue={editing.titulo} className={input} key={editing.id + "t"} required />
        </Field>
        <Field label="Descrição">
          <textarea
            name="descricao"
            defaultValue={editing.descricao}
            rows={5}
            className={input}
            key={editing.id + "d"}
            placeholder="Responsabilidades, requisitos, benefícios…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo (opc.)">
            <input name="tipo" defaultValue={editing.tipo ?? ""} className={input} key={editing.id + "tp"} placeholder="CLT, Estágio…" />
          </Field>
          <Field label="Local (opc.)">
            <input name="local" defaultValue={editing.local ?? ""} className={input} key={editing.id + "lo"} placeholder="Natal/RN" />
          </Field>
        </div>
        <Field label="Ordem">
          <input type="number" name="ordem" defaultValue={editing.ordem} className={input} key={editing.id + "o"} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={editing.ativo} key={editing.id + "a"} />
          Ativa (aparece no institucional)
        </label>

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

function VagaRow({ v, onEdit, onDelete }: { v: Vaga; onEdit: () => void; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function criarBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setMsg(null);
    const up = await uploadDireto("marketing", f);
    if (up.error || !up.url) {
      setBusy(false);
      setMsg(up.error ?? "Falha no upload.");
      return;
    }
    const r = await criarBannerDaVagaAction(v.titulo, up.url);
    setBusy(false);
    setMsg(r.error ?? "Banner criado ✓ (veja em Banners)");
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">{v.titulo}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {v.ativo ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">ativa</span>
            ) : (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-semibold text-zinc-700">inativa</span>
            )}
            {v.tipo && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{v.tipo}</span>}
            {v.local && <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">{v.local}</span>}
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">ordem {v.ordem}</span>
          </div>
          {v.descricao && <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{v.descricao}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} title="Editar" className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand-600">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} title="Excluir" className="rounded p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Sobe uma imagem e cria um banner na home linkado à seção de vagas"
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          <ImagePlus className="h-4 w-4" />
          {busy ? "Criando banner..." : "Criar banner desta vaga"}
        </button>
        {msg && <span className={`text-xs ${msg.includes("✓") ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={criarBanner} />
      </div>
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
