"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Trash2, Star } from "lucide-react";

import { Field, MetaCounter, input } from "../_components/form-ui";
import { FaqRepeater, type FaqItem } from "../_components/FaqRepeater";
import { GoogleSnippetPreview } from "../_components/GoogleSnippetPreview";
import { SEO_LIMITS } from "@/lib/seo/metadata";
import { slugify } from "../_lib/slug";
import { deleteClusterAction, saveClusterAction } from "./actions";

export type StatusConteudo = "rascunho" | "publicado" | "arquivado";

export type Cluster = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string;
  intro: string;
  meta_title: string;
  meta_description: string;
  artigo_pilar_id: string;
  ordem: number;
  status: StatusConteudo;
  faq: FaqItem[];
};

export type ArtigoOpcao = {
  id: string;
  titulo: string;
  slug: string;
  cluster_id: string | null;
  eh_pilar: boolean;
};

const empty: Cluster = {
  id: "",
  slug: "",
  titulo: "",
  subtitulo: "",
  intro: "",
  meta_title: "",
  meta_description: "",
  artigo_pilar_id: "",
  ordem: 0,
  status: "rascunho",
  faq: [],
};

const STATUS_LABEL: Record<StatusConteudo, string> = {
  rascunho: "rascunho",
  publicado: "publicado",
  arquivado: "arquivado",
};

function StatusBadge({ status }: { status: StatusConteudo }) {
  if (status === "publicado") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        publicado
      </span>
    );
  }
  if (status === "arquivado") {
    return (
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">
        arquivado
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
      rascunho
    </span>
  );
}

export function ClustersManager({
  clusters,
  artigos,
  contagem,
}: {
  clusters: Cluster[];
  artigos: ArtigoOpcao[];
  contagem: Record<string, number>;
}) {
  const [editing, setEditing] = useState<Cluster>(empty);
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Slug efetivo (auto a partir do título enquanto o admin não editar o campo).
  const slugEfetivo = slugTocado ? slug : slugify(titulo);

  function startEdit(c: Cluster) {
    setEditing(c);
    setTitulo(c.titulo);
    setSlug(c.slug);
    setSlugTocado(true);
    setMetaTitle(c.meta_title);
    setMetaDescription(c.meta_description);
    setFaq(c.faq);
    setErro(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditing(empty);
    setTitulo("");
    setSlug("");
    setSlugTocado(false);
    setMetaTitle("");
    setMetaDescription("");
    setFaq([]);
    setErro(null);
  }

  function onSubmit(formData: FormData) {
    setErro(null);
    if (editing.id) formData.set("id", editing.id);
    formData.set("titulo", titulo);
    formData.set("slug", slugEfetivo);
    formData.set("meta_title", metaTitle);
    formData.set("meta_description", metaDescription);
    formData.set(
      "faq",
      JSON.stringify(
        faq
          .filter((f) => f.question.trim() && f.answer.trim())
          .map((f) => ({ pergunta: f.question, resposta: f.answer })),
      ),
    );
    startTransition(async () => {
      const r = await saveClusterAction(undefined, formData);
      if (r.error) setErro(r.error);
      else reset();
    });
  }

  function handleDelete(id: string, nome: string) {
    if (
      !confirm(
        `Apagar cluster "${nome}"? Os artigos vinculados não serão apagados (ficam sem cluster).`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteClusterAction(id);
      if (r.error) setErro(r.error);
      else if (editing.id === id) reset();
    });
  }

  // Artigos elegíveis para "pilar" deste cluster: do próprio cluster ou ainda sem cluster.
  const pilarOpcoes = useMemo(() => {
    return artigos.filter(
      (a) => !a.cluster_id || a.cluster_id === editing.id || a.id === editing.artigo_pilar_id,
    );
  }, [artigos, editing.id, editing.artigo_pilar_id]);

  const tituloPorId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of artigos) m[a.id] = a.titulo;
    return m;
  }, [artigos]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Lista */}
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Cluster</th>
                <th className="px-4 py-2">Artigo-pilar</th>
                <th className="px-4 py-2 text-right">Artigos</th>
                <th className="px-4 py-2 text-right">Ordem</th>
                <th className="px-4 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    <div className="font-medium text-zinc-900">{c.titulo}</div>
                    <div className="font-mono text-xs text-zinc-400">{c.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    {c.artigo_pilar_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-700">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {tituloPorId[c.artigo_pilar_id] ?? "—"}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{contagem[c.id] ?? 0}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.ordem}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(c)}
                      className="mr-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-brand-600"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.titulo)}
                      className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {clusters.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    Nenhum cluster cadastrado.
                    <br />
                    <span className="text-xs text-zinc-400">
                      Os 10 clusters padrão são criados pela migration 0019. Enquanto ela
                      não roda, cadastre no formulário ao lado.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Prévia da SERP do cluster (rota /guias/[slug]) */}
        {(titulo || metaTitle || metaDescription) && (
          <GoogleSnippetPreview
            titulo={metaTitle || titulo}
            slug={slugEfetivo}
            description={metaDescription}
            pathLabel="guias"
          />
        )}
      </div>

      {/* Form */}
      <form
        action={onSubmit}
        className="h-fit space-y-3 rounded-lg border border-zinc-200 bg-white p-5"
      >
        <h2 className="font-semibold">
          {editing.id ? `Editar: ${editing.titulo}` : "Novo cluster"}
        </h2>

        <Field label="Título *">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            className={input}
          />
        </Field>

        <Field label="Slug" hint="Gerado a partir do título. Edite só se necessário.">
          <input
            value={slugEfetivo}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="auto"
            className={input}
          />
        </Field>

        <Field label="Keyword principal" hint="Usada como referência editorial (não persistida).">
          <input name="keyword_principal" defaultValue="" className={input} key={editing.id + "kp"} />
        </Field>

        <Field
          label="Keywords secundárias"
          hint="Separe por vírgula. Referência editorial (não persistida)."
        >
          <input name="keywords_secundarias" defaultValue="" className={input} key={editing.id + "ks"} />
        </Field>

        <Field label="Subtítulo">
          <input
            name="subtitulo"
            defaultValue={editing.subtitulo}
            className={input}
            key={editing.id + "sub"}
          />
        </Field>

        <Field label="Descrição / intro" hint="Prosa de abertura da página-pilar.">
          <textarea
            name="intro"
            defaultValue={editing.intro}
            rows={4}
            className={input}
            key={editing.id + "intro"}
          />
        </Field>

        <Field label="Artigo-pilar">
          <select
            name="artigo_pilar_id"
            defaultValue={editing.artigo_pilar_id}
            className={input}
            key={editing.id + "pilar"}
          >
            <option value="">— Nenhum —</option>
            {pilarOpcoes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo}
                {a.eh_pilar ? " (pilar)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ordem">
            <input
              type="number"
              name="ordem"
              defaultValue={editing.ordem}
              className={input}
              key={editing.id + "ord"}
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={editing.status}
              className={input}
              key={editing.id + "st"}
            >
              {(Object.keys(STATUS_LABEL) as StatusConteudo[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Meta title">
          <MetaCounter
            value={metaTitle}
            onChange={setMetaTitle}
            max={SEO_LIMITS.TITLE_MAX}
            min={20}
            rows={2}
            name="meta_title"
            placeholder={titulo || "Título para o Google"}
          />
        </Field>

        <Field label="Meta description">
          <MetaCounter
            value={metaDescription}
            onChange={setMetaDescription}
            max={SEO_LIMITS.DESC_MAX}
            min={SEO_LIMITS.DESC_MIN}
            rows={3}
            name="meta_description"
            placeholder="Resumo do guia para os resultados de busca."
          />
        </Field>

        <div className="border-t border-zinc-100 pt-3">
          <FaqRepeater value={faq} onChange={setFaq} />
        </div>

        {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

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
