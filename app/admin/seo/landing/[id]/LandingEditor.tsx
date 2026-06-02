"use client";

// Editor de Landing page (Conteúdo / SEO — Fase 3). Molde do editor de artigo:
// formulário à esquerda (campos + BlocksEditor + ProdutoPicker + FaqRepeater),
// painel ao vivo à direita (SeoScorePanel + GoogleSnippetPreview + OgCardPreview).
// CONTROLADO: corpo/faq/produtos_destaque viajam por hidden inputs em JSON no
// submit (mesmo truque do ProdutoForm). useActionState liga create/update.
// Design ADMIN (limpo): bg-white / border-zinc-200 / acento brand-600.

import { useActionState, useMemo, useState, useTransition } from "react";

import type { ArticleBlock } from "@/lib/articles";
import { uploadParaBucket } from "@/app/admin/_lib/upload";
import { buildWaLinkLoja } from "@/lib/whatsapp";
import { BlocksEditor } from "../../_components/BlocksEditor";
import { FaqRepeater, type FaqItem } from "../../_components/FaqRepeater";
import { Field, MetaCounter, input } from "../../_components/form-ui";
import { GoogleSnippetPreview } from "../../_components/GoogleSnippetPreview";
import { OgCardPreview } from "../../_components/OgCardPreview";
import {
  ProdutoPicker,
  type PickerProduto,
} from "../../_components/ProdutoPicker";
import { SeoScorePanel, type SeoScoreInput } from "../../_components/SeoScorePanel";
import { SEO_LIMITS } from "@/lib/seo/metadata";
import { readingTimeMin, readingTimeLabel } from "../../_lib/reading-time";
import {
  createLandingAction,
  deleteLandingAction,
  setStatusLandingAction,
  updateLandingAction,
} from "../actions";

export type Option = { id: string; nome: string };
export type ClusterOption = { id: string; titulo: string };

export type LandingFormValue = {
  id?: string;
  slug: string;
  titulo: string;
  subtitulo: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  cidade: string;
  uf: string;
  publico: string;
  heroImagem: string;
  corpo: ArticleBlock[];
  produtosDestaque: string[];
  categoriaId: string;
  marcaId: string;
  clusterId: string;
  faq: FaqItem[];
  status: "rascunho" | "publicado" | "arquivado";
};

type State = { error?: string; ok?: boolean } | undefined;

export function LandingEditor({
  landing,
  produtos,
  categorias,
  marcas,
  clusters,
}: {
  landing: LandingFormValue;
  produtos: PickerProduto[];
  categorias: Option[];
  marcas: Option[];
  clusters: ClusterOption[];
}) {
  const isNew = !landing.id;
  const action = isNew
    ? createLandingAction
    : updateLandingAction.bind(null, landing.id!);
  const [state, formAction, pending] = useActionState<State, FormData>(
    action,
    undefined,
  );

  // Estado controlado dos campos que alimentam previews/score e os hidden inputs.
  const [titulo, setTitulo] = useState(landing.titulo);
  const [slug, setSlug] = useState(landing.slug);
  const [subtitulo, setSubtitulo] = useState(landing.subtitulo);
  const [metaTitle, setMetaTitle] = useState(landing.metaTitle);
  const [metaDescription, setMetaDescription] = useState(landing.metaDescription);
  const [primaryKeyword, setPrimaryKeyword] = useState(landing.primaryKeyword);
  const [heroImagem, setHeroImagem] = useState(landing.heroImagem);
  const [corpo, setCorpo] = useState<ArticleBlock[]>(landing.corpo);
  const [faq, setFaq] = useState<FaqItem[]>(landing.faq);
  const [produtosDestaque, setProdutosDestaque] = useState<string[]>(
    landing.produtosDestaque,
  );
  const [status, setStatus] = useState(landing.status);

  const [statusPending, startStatus] = useTransition();
  const [delPending, startDelete] = useTransition();

  // slug efetivo (gerado do título quando o campo está vazio) só para preview.
  const slugPreview = slug.trim() || autoSlug(titulo);

  // O título da meta (SERP/OG) cai no título da página quando vazio.
  const effectiveTitle = metaTitle.trim() || titulo;
  const effectiveDesc = metaDescription.trim() || subtitulo;

  // CTA = link wa.me da loja com mensagem automática (mesmo padrão do público).
  const ctaLink = buildWaLinkLoja(
    `Olá! Vi a página "${titulo || "Landing page"}" no site da Natalmaq e quero solicitar um orçamento.`,
  );

  // IMPORTANTE: objeto memoizado p/ o debounce do SeoScorePanel não reiniciar
  // a cada render (ver nota do componente).
  const scoreInput = useMemo<SeoScoreInput>(
    () => ({
      titulo: effectiveTitle,
      excerpt: effectiveDesc,
      keywords: primaryKeyword.trim() ? [primaryKeyword.trim()] : [],
      conteudo: corpo,
      imagemAlt: titulo,
      slug: slugPreview,
      faq,
    }),
    [effectiveTitle, effectiveDesc, primaryKeyword, corpo, titulo, slugPreview, faq],
  );

  const readMin = readingTimeMin(corpo);

  function handleStatus(novo: "rascunho" | "publicado" | "arquivado") {
    setStatus(novo);
    if (isNew || !landing.id) return; // ainda não existe: só atualiza o hidden.
    startStatus(async () => {
      await setStatusLandingAction(landing.id!, novo);
    });
  }

  function handleDelete() {
    if (!landing.id) return;
    if (!confirm("Apagar esta landing page? Essa ação é irreversível.")) return;
    startDelete(async () => {
      await deleteLandingAction(landing.id!);
    });
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Hidden inputs serializados (JSON / strings controladas). */}
      <input type="hidden" name="corpo" value={JSON.stringify(corpo)} />
      <input type="hidden" name="faq" value={JSON.stringify(faq)} />
      <input
        type="hidden"
        name="produtos_destaque"
        value={JSON.stringify(produtosDestaque)}
      />
      <input type="hidden" name="hero_imagem" value={heroImagem} />
      <input type="hidden" name="status" value={status} />

      {/* ---------- COLUNA ESQUERDA: edição ---------- */}
      <div className="space-y-6">
        {/* Bloco: identificação */}
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Identificação</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título / H1 *" className="md:col-span-2">
              <input
                name="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                placeholder="Locação de andaimes em Natal/RN"
                className={input}
              />
            </Field>
            <Field
              label="Slug (URL)"
              hint="/solucoes/… — gerado do título se vazio"
            >
              <input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="gerado automaticamente"
                className={input}
              />
            </Field>
            <Field label="Palavra-chave principal" hint="Usada no SEO Score">
              <input
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                placeholder="andaimes natal"
                className={input}
              />
            </Field>
            <Field label="Subtítulo" className="md:col-span-2">
              <textarea
                name="subtitulo"
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                rows={2}
                placeholder="Orçamento rápido, entrega na obra e suporte local."
                className={input}
              />
            </Field>
          </div>
        </section>

        {/* Bloco: segmentação local / público */}
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Segmentação local
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cidade">
              <input
                name="cidade"
                defaultValue={landing.cidade}
                placeholder="Natal"
                className={input}
              />
            </Field>
            <Field label="UF">
              <input
                name="uf"
                defaultValue={landing.uf}
                maxLength={2}
                placeholder="RN"
                className={input}
              />
            </Field>
            <Field label="Público-alvo">
              <input
                name="publico"
                defaultValue={landing.publico}
                placeholder="construtoras"
                className={input}
              />
            </Field>
          </div>
        </section>

        {/* Bloco: hero + CTA WhatsApp */}
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Hero e chamada de ação
          </h2>
          <p className="text-xs text-zinc-500">
            No site, o hero usa o <strong>Título/H1</strong> como headline, o{" "}
            <strong>Subtítulo</strong> como subheadline e o botão de orçamento via
            WhatsApp da loja (mensagem automática com o nome da página).
          </p>

          {/* Prévia do hero (look industrial do site público) */}
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <div className="relative bg-navy p-5">
              {heroImagem && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImagem}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-25"
                  />
                  <div className="absolute inset-0 bg-navy/60" />
                </>
              )}
              <div className="relative">
                {(landing.cidade || landing.uf) && (
                  <span className="inline-block border border-brand-500/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brand-400">
                    {[landing.cidade, landing.uf].filter(Boolean).join("/")}
                  </span>
                )}
                <p className="mt-2 font-display text-xl leading-tight tracking-tight text-white">
                  {titulo || "Título / H1 da landing"}
                </p>
                {subtitulo && (
                  <p className="mt-1.5 max-w-md text-sm text-white/70">{subtitulo}</p>
                )}
                <span className="mt-3 inline-block bg-brand-500 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-white">
                  Solicitar orçamento no WhatsApp
                </span>
              </div>
            </div>
          </div>
          <p className="break-all text-xs text-zinc-400">
            Link do CTA:{" "}
            <span className="font-mono">{ctaLink}</span>
          </p>

          <HeroUpload value={heroImagem} onChange={setHeroImagem} />
        </section>

        {/* Bloco: corpo (blocos) */}
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Corpo da página</h2>
            <span className="text-xs text-zinc-400">
              {readingTimeLabel(readMin)}
            </span>
          </div>
          <BlocksEditor value={corpo} onChange={setCorpo} />
        </section>

        {/* Bloco: vínculos */}
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Vínculos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Categoria">
              <select
                name="categoria_id"
                defaultValue={landing.categoriaId}
                className={input}
              >
                <option value="">—</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marca">
              <select
                name="marca_id"
                defaultValue={landing.marcaId}
                className={input}
              >
                <option value="">—</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cluster">
              <select
                name="cluster_id"
                defaultValue={landing.clusterId}
                className={input}
              >
                <option value="">—</option>
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {/* Bloco: vitrine de produtos */}
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Vitrine de produtos em destaque
          </h2>
          <ProdutoPicker
            produtos={produtos}
            selectedIds={produtosDestaque}
            onChange={setProdutosDestaque}
            max={12}
          />
        </section>

        {/* Bloco: FAQ */}
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <FaqRepeater value={faq} onChange={setFaq} />
        </section>

        {/* Mensagens + ações */}
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
            {pending
              ? "Salvando..."
              : isNew
                ? "Criar landing page"
                : "Salvar alterações"}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={delPending}
              className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
            >
              {delPending ? "Apagando..." : "Apagar landing page"}
            </button>
          )}
        </div>
      </div>

      {/* ---------- COLUNA DIREITA: previews ao vivo ---------- */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {/* Meta + status */}
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Publicação</h3>
          <div className="flex gap-2">
            {(["rascunho", "publicado", "arquivado"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatus(s)}
                disabled={statusPending}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition disabled:opacity-50 ${
                  status === s
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Field label="Meta title" hint={`Recomendado até ${SEO_LIMITS.TITLE_MAX}`}>
            <MetaCounter
              value={metaTitle}
              onChange={setMetaTitle}
              max={SEO_LIMITS.TITLE_MAX}
              name="meta_title"
              rows={2}
              placeholder="Título exibido na busca (usa o H1 se vazio)"
            />
          </Field>
          <Field
            label="Meta description"
            hint={`Ideal ${SEO_LIMITS.DESC_MIN}-${SEO_LIMITS.DESC_MAX}`}
          >
            <MetaCounter
              value={metaDescription}
              onChange={setMetaDescription}
              max={SEO_LIMITS.DESC_MAX}
              min={SEO_LIMITS.DESC_MIN}
              name="meta_description"
              rows={3}
              placeholder="Resumo que aparece no Google (usa o subtítulo se vazio)"
            />
          </Field>
        </div>

        <SeoScorePanel input={scoreInput} />
        <GoogleSnippetPreview
          titulo={effectiveTitle}
          slug={slugPreview}
          description={effectiveDesc}
          pathLabel="solucoes"
        />
        <OgCardPreview titulo={effectiveTitle} imagem={heroImagem || null} />
      </aside>
    </form>
  );
}

// Slug local só para preview (o servidor reslugifica no save com o slug oficial).
function autoSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Upload da imagem do hero para o bucket "conteudo" (estende a union do upload).
function HeroUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadParaBucket("conteudo", fd);
      if (r.error) setError(r.error);
      else if (r.url) onChange(r.url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50">
          {uploading ? "Enviando..." : value ? "Trocar imagem" : "+ Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Remover
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {value ? (
        <div className="overflow-hidden rounded-md border border-zinc-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-40 w-full object-cover" />
        </div>
      ) : (
        <p className="rounded-md border-2 border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
          Nenhuma imagem. O hero usa o look industrial no card de compartilhamento.
        </p>
      )}
    </div>
  );
}
