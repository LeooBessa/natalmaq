"use client";

// Editor de artigo (Fase 3). "use client" + useActionState(updateArtigoAction).
// Layout: grid lg:grid-cols-[minmax(0,1fr)_360px]
//   - esquerda: abas "Conteúdo" (BlocksEditor + título/slug) e "SEO & Metadados".
//   - direita (sticky): SeoScorePanel + GoogleSnippetPreview + OgCardPreview +
//     InternalLinksReview.
// Toolbar sticky no topo: voltar, status toggle, "Ver no site", "Exportar brief",
// Salvar. blocks/faq/howto são serializados em hidden inputs JSON no submit.
// reading_time é CALCULADO (readingTimeMin), não digitado.

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  Clipboard,
  ExternalLink,
  Lock,
  Sparkles,
} from "lucide-react";

import type { ArticleBlock } from "@/lib/articles";
import { BlocksEditor } from "@/app/admin/seo/_components/BlocksEditor";
import { Field, MetaCounter, input } from "@/app/admin/seo/_components/form-ui";
import { FaqRepeater, type FaqItem } from "@/app/admin/seo/_components/FaqRepeater";
import {
  HowToRepeater,
  type HowToValue,
} from "@/app/admin/seo/_components/HowToRepeater";
import {
  SeoScorePanel,
  type SeoScoreInput,
} from "@/app/admin/seo/_components/SeoScorePanel";
import { GoogleSnippetPreview } from "@/app/admin/seo/_components/GoogleSnippetPreview";
import { OgCardPreview } from "@/app/admin/seo/_components/OgCardPreview";
import {
  InternalLinksReview,
  type LinkSugestao,
} from "@/app/admin/seo/_components/InternalLinksReview";
import type { PickerProduto } from "@/app/admin/seo/_components/ProdutoPicker";
import { slugify } from "@/app/admin/seo/_lib/slug";
import {
  readingTimeMin,
  readingTimeLabel,
} from "@/app/admin/seo/_lib/reading-time";
import { exportBrief } from "@/app/admin/seo/_lib/export-brief";
import { SEO_LIMITS } from "@/lib/seo/metadata";

import {
  deleteArtigoAction,
  setStatusArtigoAction,
  sugerirLinksAction,
  uploadCapaAction,
  updateArtigoAction,
} from "../actions";

type Status = "rascunho" | "publicado" | "arquivado";

export type ArtigoEditorData = {
  id: string;
  slug: string;
  titulo: string;
  categoria_label: string;
  excerpt: string;
  imagem: string;
  corpo: ArticleBlock[];
  cluster_id: string;
  cluster_slug?: string;
  eh_pilar: boolean;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  status: Status;
  published_at: string; // YYYY-MM-DD
  autor_nome: string;
  reading_time: number;
  faq: FaqItem[];
  howto: HowToValue;
};

type ClusterOpt = { id: string; titulo: string; slug: string };
type State = { error?: string; ok?: boolean } | undefined;

type Aba = "conteudo" | "seo";

export function ArtigoEditor({
  artigo,
  clusters,
  produtos,
}: {
  artigo: ArtigoEditorData;
  clusters: ClusterOpt[];
  produtos: PickerProduto[];
}) {
  const action = updateArtigoAction.bind(null, artigo.id);
  const [state, formAction, pending] = useActionState<State, FormData>(
    action,
    undefined,
  );

  const [aba, setAba] = useState<Aba>("conteudo");

  // --- Campos controlados ---------------------------------------------------
  const [titulo, setTitulo] = useState(artigo.titulo);
  const [slug, setSlug] = useState(artigo.slug);
  const [slugLocked, setSlugLocked] = useState(true);
  const [excerpt, setExcerpt] = useState(artigo.excerpt);
  const [metaTitle, setMetaTitle] = useState(artigo.meta_title);
  const [metaDescription, setMetaDescription] = useState(
    artigo.meta_description,
  );
  const [categoriaLabel, setCategoriaLabel] = useState(artigo.categoria_label);
  const [clusterId, setClusterId] = useState(artigo.cluster_id);
  const [ehPilar, setEhPilar] = useState(artigo.eh_pilar);
  const [primaryKeyword, setPrimaryKeyword] = useState(
    artigo.keywords[0] ?? "",
  );
  const [secKeywords, setSecKeywords] = useState(
    artigo.keywords.slice(1).join("\n"),
  );
  const [autorNome, setAutorNome] = useState(artigo.autor_nome);
  const [publishedAt, setPublishedAt] = useState(artigo.published_at);
  const [status, setStatus] = useState<Status>(artigo.status);

  const [blocks, setBlocks] = useState<ArticleBlock[]>(artigo.corpo);
  const [faq, setFaq] = useState<FaqItem[]>(artigo.faq);
  const [howto, setHowto] = useState<HowToValue>(artigo.howto);

  const [imagem, setImagem] = useState<string>(artigo.imagem);
  // O alt da capa NÃO tem coluna na 0019: é só client-side (alimenta o score).
  // FOLLOWUP: migration futura `alter table artigos add column imagem_alt text`.
  const [imagemAlt, setImagemAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [delPending, startDelete] = useTransition();
  const [statusPending, startStatus] = useTransition();

  // --- Derivados ------------------------------------------------------------
  // keywords = primária + secundárias (1 por linha), na ordem; keywords[0] é a
  // principal (contrato do score).
  const keywords = useMemo(() => {
    const sec = secKeywords
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const prim = primaryKeyword.trim();
    return prim ? [prim, ...sec] : sec;
  }, [primaryKeyword, secKeywords]);

  const readingTime = useMemo(() => readingTimeMin(blocks), [blocks]);

  // Objeto MEMOIZADO para o SeoScorePanel (senão o debounce reinicia a cada
  // render). excerpt do score = meta_description quando há, senão o resumo.
  const scoreInput: SeoScoreInput = useMemo(
    () => ({
      titulo,
      excerpt: metaDescription || excerpt,
      keywords,
      conteudo: blocks,
      imagemAlt,
      slug,
      faq,
    }),
    [titulo, metaDescription, excerpt, keywords, blocks, imagemAlt, slug, faq],
  );

  // --- Sugestões de links internos (server action) --------------------------
  const [sugestoes, setSugestoes] = useState<LinkSugestao[]>([]);
  const [sugerindo, startSugerir] = useTransition();

  function gerarSugestoes() {
    startSugerir(async () => {
      const r = await sugerirLinksAction({
        slug,
        titulo,
        keywords,
        cluster: artigo.cluster_slug,
        blocks,
      });
      setSugestoes(r);
    });
  }

  // --- Slug automático a partir do título (enquanto travado) ----------------
  useEffect(() => {
    if (slugLocked) setSlug(slugify(titulo));
  }, [titulo, slugLocked]);

  // --- Upload da capa -------------------------------------------------------
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadCapaAction(fd);
      if (r.error) setUploadError(r.error);
      else if (r.url) setImagem(r.url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // --- Toolbar: status toggle ----------------------------------------------
  function toggleStatus() {
    const proximo: Status = status === "publicado" ? "rascunho" : "publicado";
    startStatus(async () => {
      const r = await setStatusArtigoAction(artigo.id, proximo);
      if (!r?.error) setStatus(proximo);
    });
  }

  function handleDelete() {
    if (!confirm("Apagar este artigo? Essa ação é irreversível.")) return;
    startDelete(async () => {
      await deleteArtigoAction(artigo.id);
    });
  }

  // --- Exportar brief (copia para o clipboard) ------------------------------
  const [briefCopiado, setBriefCopiado] = useState(false);
  async function copiarBrief() {
    const texto = exportBrief({
      cluster: clusters.find((c) => c.id === clusterId)?.titulo,
      primaryKeyword,
      secondaryKeywords: keywords.slice(1),
      titulo,
      // Prefere os produtos sugeridos pelo motor; senão, semeia com itens reais
      // do catálogo (produtos carregados pela página) para guiar o redator.
      sugestoesProdutos:
        sugestoes.filter((s) => s.tipo === "produto").length > 0
          ? sugestoes
              .filter((s) => s.tipo === "produto")
              .map((s) => s.anchor)
          : produtos.slice(0, 6).map((p) => p.nome),
    });
    try {
      await navigator.clipboard.writeText(texto);
      setBriefCopiado(true);
      setTimeout(() => setBriefCopiado(false), 2000);
    } catch {
      // clipboard indisponível: abre prompt como fallback.
      window.prompt("Copie o brief:", texto);
    }
  }

  const publicado = status === "publicado";

  return (
    <form action={formAction} className="space-y-5">
      {/* hidden inputs serializados no submit */}
      <input type="hidden" name="titulo" value={titulo} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="excerpt" value={excerpt} />
      <input type="hidden" name="meta_title" value={metaTitle} />
      <input type="hidden" name="meta_description" value={metaDescription} />
      <input type="hidden" name="categoria_label" value={categoriaLabel} />
      <input type="hidden" name="cluster_id" value={clusterId} />
      {ehPilar && <input type="hidden" name="eh_pilar" value="on" />}
      <input type="hidden" name="keywords" value={keywords.join("\n")} />
      <input type="hidden" name="autor_nome" value={autorNome} />
      <input type="hidden" name="published_at" value={publishedAt} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="imagem" value={imagem} />
      <input type="hidden" name="corpo" value={JSON.stringify(blocks)} />
      <input type="hidden" name="faq" value={JSON.stringify(faq)} />
      <input
        type="hidden"
        name="howto"
        value={howto ? JSON.stringify(howto) : ""}
      />

      {/* Toolbar sticky */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/seo/artigos"
            className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" /> Artigos
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="max-w-[280px] truncate text-sm text-zinc-500">
            {titulo || "(sem título)"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            {readingTimeLabel(readingTime)}
          </span>

          <button
            type="button"
            onClick={toggleStatus}
            disabled={statusPending}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              publicado
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
            }`}
          >
            {statusPending
              ? "..."
              : publicado
                ? "Publicado"
                : "Despublicado"}
          </button>

          {publicado && (
            <a
              href={`/artigos/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver no site
            </a>
          )}

          <button
            type="button"
            onClick={copiarBrief}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Clipboard className="h-3.5 w-3.5" />
            {briefCopiado ? "Copiado!" : "Exportar brief"}
          </button>

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Toasts */}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Coluna esquerda: abas */}
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-zinc-200">
            <TabButton
              active={aba === "conteudo"}
              onClick={() => setAba("conteudo")}
            >
              Conteúdo
            </TabButton>
            <TabButton active={aba === "seo"} onClick={() => setAba("seo")}>
              SEO &amp; Metadados
            </TabButton>
          </div>

          {aba === "conteudo" ? (
            <div className="space-y-4">
              <Field label="Título">
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Como escolher o EPI certo para sua obra"
                  className={input}
                />
              </Field>

              <Field
                label="Slug (URL)"
                hint={slugLocked ? "Gerado do título. Clique no cadeado para editar." : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-zinc-400">
                    /artigos/
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    disabled={slugLocked}
                    className={`${input} ${slugLocked ? "bg-zinc-50 text-zinc-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSlugLocked((v) => !v)}
                    className="shrink-0 rounded-md border border-zinc-300 bg-white p-2 text-zinc-500 hover:bg-zinc-50"
                    aria-label={slugLocked ? "Destravar slug" : "Travar slug"}
                    title={slugLocked ? "Destravar slug" : "Travar slug"}
                  >
                    <Lock
                      className={`h-4 w-4 ${slugLocked ? "text-brand-600" : "text-zinc-400"}`}
                    />
                  </button>
                </div>
              </Field>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">
                  Conteúdo (blocos)
                </h3>
                <BlocksEditor value={blocks} onChange={setBlocks} />
              </div>
            </div>
          ) : (
            <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
              <Field
                label="Meta title"
                hint={`Recomendado até ${SEO_LIMITS.TITLE_MAX} caracteres.`}
              >
                <MetaCounter
                  value={metaTitle}
                  onChange={setMetaTitle}
                  max={SEO_LIMITS.TITLE_MAX}
                  rows={2}
                  placeholder={titulo || "Título exibido no Google"}
                />
              </Field>

              <Field
                label="Meta description"
                hint={`Ideal entre ${SEO_LIMITS.DESC_MIN} e ${SEO_LIMITS.DESC_MAX} caracteres.`}
              >
                <MetaCounter
                  value={metaDescription}
                  onChange={setMetaDescription}
                  max={SEO_LIMITS.DESC_MAX}
                  min={SEO_LIMITS.DESC_MIN}
                  rows={3}
                  placeholder="Resumo que aparece na busca do Google."
                />
              </Field>

              <Field label="Resumo (excerpt do card)">
                <textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                  placeholder="Frase de chamada exibida no carrossel de artigos."
                  className={input}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categoria (badge)">
                  <input
                    value={categoriaLabel}
                    onChange={(e) => setCategoriaLabel(e.target.value)}
                    placeholder="Segurança"
                    className={input}
                  />
                </Field>
                <Field label="Cluster">
                  <select
                    value={clusterId}
                    onChange={(e) => setClusterId(e.target.value)}
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

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ehPilar}
                  onChange={(e) => setEhPilar(e.target.checked)}
                />
                <span className="text-sm text-zinc-700">
                  Este é o artigo pilar do cluster
                </span>
              </label>

              <Field label="Palavra-chave principal">
                <input
                  value={primaryKeyword}
                  onChange={(e) => setPrimaryKeyword(e.target.value)}
                  placeholder="equipamento de proteção individual"
                  className={input}
                />
              </Field>

              <Field
                label="Palavras-chave secundárias"
                hint="Uma por linha (ou separadas por vírgula)."
              >
                <textarea
                  value={secKeywords}
                  onChange={(e) => setSecKeywords(e.target.value)}
                  rows={3}
                  placeholder={"capacete de segurança\nluva de proteção\nNR-6"}
                  className={input}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Autor">
                  <input
                    value={autorNome}
                    onChange={(e) => setAutorNome(e.target.value)}
                    placeholder="Equipe Natalmaq"
                    className={input}
                  />
                </Field>
                <Field label="Data de publicação">
                  <input
                    type="date"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className={input}
                  />
                </Field>
              </div>

              {/* Imagem de capa + alt */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Imagem de capa
                  </h3>
                  <label className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50">
                    {uploading ? "Enviando..." : imagem ? "Trocar" : "+ Upload"}
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
                {imagem ? (
                  <div className="relative h-40 w-full overflow-hidden rounded-md border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagem}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImagem("")}
                      className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white hover:bg-black"
                      aria-label="Remover capa"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <p className="rounded-md border-2 border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
                    Nenhuma capa. Usada no hero do artigo e no card de
                    compartilhamento.
                  </p>
                )}
                <Field
                  label="Texto alternativo (alt) da capa"
                  hint="Descreve a imagem para acessibilidade e SEO. (Não é persistido ainda — alimenta o score.)"
                >
                  <input
                    value={imagemAlt}
                    onChange={(e) => setImagemAlt(e.target.value)}
                    placeholder="Operário com capacete e luvas em obra"
                    className={input}
                  />
                </Field>
              </div>

              <hr className="border-zinc-200" />
              <FaqRepeater value={faq} onChange={setFaq} />

              <hr className="border-zinc-200" />
              <HowToRepeater value={howto} onChange={setHowto} />
            </div>
          )}
        </div>

        {/* Coluna direita: sticky */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <SeoScorePanel input={scoreInput} />

          <GoogleSnippetPreview
            titulo={metaTitle || titulo}
            slug={slug}
            description={metaDescription || excerpt}
          />

          <OgCardPreview titulo={titulo} imagem={imagem || null} />

          <div className="space-y-2">
            <button
              type="button"
              onClick={gerarSugestoes}
              disabled={sugerindo}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {sugerindo ? "Gerando..." : "Gerar sugestões de links"}
            </button>
            <InternalLinksReview sugestoes={sugestoes} />
          </div>
        </aside>
      </div>

      {/* Rodapé: apagar */}
      <div className="flex justify-end border-t border-zinc-200 pt-4">
        <button
          type="button"
          onClick={handleDelete}
          disabled={delPending}
          className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          {delPending ? "Apagando..." : "Apagar artigo"}
        </button>
      </div>
    </form>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-zinc-500 hover:text-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
