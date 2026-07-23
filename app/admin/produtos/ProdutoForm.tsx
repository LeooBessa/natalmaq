"use client";

import { useActionState, useState, useTransition } from "react";

import {
  createProdutoAction,
  deleteProdutoAction,
  updateProdutoAction,
} from "./actions";
import { uploadDireto } from "@/lib/supabase/upload-client";

type Marca = { id: string; nome: string };
type Categoria = { id: string; nome: string };

type Produto = {
  id?: string;
  codigo: string;
  slug: string;
  nome: string;
  descricao: string | null;
  marca_id: string | null;
  categoria_id: string | null;
  preco: number;
  preco_promocional: number | null;
  promo_travada?: boolean;
  estoque: number;
  peso_kg: number;
  ativo: boolean;
  destaque: boolean;
  imagens: string[];
};

type State = { error?: string; ok?: boolean } | undefined;

export function ProdutoForm({
  produto,
  marcas,
  categorias,
}: {
  produto: Produto;
  marcas: Marca[];
  categorias: Categoria[];
}) {
  const isNew = !produto.id;
  const action = isNew
    ? createProdutoAction
    : updateProdutoAction.bind(null, produto.id!);

  const [state, formAction, pending] = useActionState<State, FormData>(
    action,
    undefined,
  );

  const [imagens, setImagens] = useState<string[]>(produto.imagens ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [delPending, startDelete] = useTransition();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const r = await uploadDireto("produtos", file);
      if (r.error) setUploadError(r.error);
      else if (r.url) setImagens((arr) => [...arr, r.url!]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeImage(i: number) {
    setImagens((arr) => arr.filter((_, idx) => idx !== i));
  }

  function handleDelete() {
    if (!produto.id) return;
    if (!confirm("Apagar este produto? Essa ação é irreversível.")) return;
    startDelete(async () => {
      await deleteProdutoAction(produto.id!);
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="imagens" value={imagens.join("\n")} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Código *">
          <input
            name="codigo"
            defaultValue={produto.codigo}
            required
            className={input}
          />
        </Field>
        <Field label="Slug (URL)">
          <input
            name="slug"
            defaultValue={produto.slug}
            placeholder="gerado automaticamente do nome"
            className={input}
          />
        </Field>

        <Field label="Nome *" className="md:col-span-2">
          <input
            name="nome"
            defaultValue={produto.nome}
            required
            className={input}
          />
        </Field>

        <Field label="Descrição" className="md:col-span-2">
          <textarea
            name="descricao"
            defaultValue={produto.descricao ?? ""}
            rows={4}
            className={input}
          />
        </Field>

        <Field label="Marca">
          <select
            name="marca_id"
            defaultValue={produto.marca_id ?? ""}
            className={input}
          >
            <option value="">—</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select
            name="categoria_id"
            defaultValue={produto.categoria_id ?? ""}
            className={input}
          >
            <option value="">—</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Field>

        <Field label="Preço (R$) *">
          <input
            type="number"
            step="0.01"
            min="0"
            name="preco"
            defaultValue={produto.preco}
            required
            className={input}
          />
        </Field>
        <Field label="Preço promocional (R$)">
          <input
            type="number"
            step="0.01"
            min="0"
            name="preco_promocional"
            defaultValue={produto.preco_promocional ?? ""}
            placeholder="menor que o preço normal"
            className={input}
          />
          <p className="mt-1 text-xs text-zinc-500">
            É o preço <b>com desconto</b> — precisa ser menor que o preço
            normal. Deixe em branco se não houver promoção.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              name="promo_travada"
              defaultChecked={produto.promo_travada ?? false}
              className="mt-0.5"
            />
            <span>
              Promoção manual — não deixar o sync do DS sobrescrever.
              <br />
              Ao salvar <b>com</b> um valor de promoção, a trava liga sozinha.
              Marque isto <b>sem</b> valor para fixar “sem promoção” e barrar
              uma promoção vinda do DS.
            </span>
          </label>
        </Field>

        <Field label="Estoque *">
          <input
            type="number"
            step="1"
            min="0"
            name="estoque"
            defaultValue={produto.estoque}
            required
            className={input}
          />
        </Field>
        <Field label="Peso (kg)">
          <input
            type="number"
            step="0.001"
            min="0"
            name="peso_kg"
            defaultValue={produto.peso_kg}
            className={input}
          />
        </Field>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="ativo" defaultChecked={produto.ativo} />
          <span className="text-sm">Ativo</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="destaque" defaultChecked={produto.destaque} />
          <span className="text-sm">Destaque na home</span>
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Imagens</h3>
          <label className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50">
            {uploading ? "Enviando..." : "+ Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
        {uploadError && (
          <p className="text-sm text-red-700">{uploadError}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {imagens.map((url, i) => (
            <div key={url} className="relative h-24 w-24 overflow-hidden rounded border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-xs text-white hover:bg-black"
                aria-label="Remover"
              >
                ×
              </button>
            </div>
          ))}
          {imagens.length === 0 && (
            <p className="text-sm text-zinc-500">
              Nenhuma imagem ainda. A primeira é a capa do produto.
            </p>
          )}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Salvo com sucesso.
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Salvando..." : isNew ? "Criar produto" : "Salvar alterações"}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={delPending}
            className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
          >
            {delPending ? "Apagando..." : "Apagar produto"}
          </button>
        )}
      </div>
    </form>
  );
}

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      {children}
    </label>
  );
}
