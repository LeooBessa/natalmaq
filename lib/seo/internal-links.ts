import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import { listMarcas, listCategorias, listProdutos } from "@/lib/data";
import { listArtigos, listClusters } from "@/lib/conteudo";
import type { ArticleBlock } from "@/lib/articles";
import { normalizePt, buildNormIndexMap, type NormIndexMap } from "./normalize";
import {
  LINK_RULES,
  STOPTERMS,
  PRIORIDADE_TIPO,
  type LinkTargetType,
} from "./config";

// ============================================================================
// MOTOR DE LINKAGEM INTERNA DETERMINISTICO (doc 03)
//
// Custo ZERO em runtime: dicionario + normalizacao pt-BR + (reforco opcional)
// tsvector via RPC. NENHUMA fonte de aleatoriedade: o resultado e reproduzivel
// byte-a-byte para a mesma entrada. Roda no SAVE do artigo (admin, Fase 3); o
// render so le o resultado materializado.
//
// REGRA DE BUILD: as migrations 0019/0020 podem NAO estar aplicadas. Toda leitura
// e best-effort (lib/data.ts e lib/conteudo.ts ja sao try/catch). O RPC tsvector
// e so REFORCO opcional (try/catch). O motor funciona com produtos/categorias/
// marcas reais mesmo sem as tabelas novas.
// ============================================================================

// --- Tipos publicos (doc 03 secao 3.2 / 8.1) -------------------------------

export type { LinkTargetType };

export interface LinkTarget {
  type: LinkTargetType;
  /** uuid (Supabase) ou slug (modo transicao / categoria via querystring). */
  id: string;
  slug: string;
  /** nome canonico (para ancora "exata" quando util). */
  nome: string;
  /** /produto/{slug} | /catalogo?categoria={slug} | /marca/{slug} | /artigos/{slug} | /guias/{slug} */
  href: string;
  /** peso base por tipo: ver config.PRIORIDADE_TIPO. */
  prioridade: number;
}

export interface DictEntry {
  /** termo JA normalizado (normalizePt). */
  termo: string;
  /** numero de palavras (para casar n-gramas maiores primeiro). */
  ngram: number;
  target: LinkTarget;
  fonte: "nome" | "slug" | "keyword" | "sinonimo";
}

export interface InlineLink {
  /** indice no content[] do artigo. */
  blockIndex: number;
  /** se for `list`, qual item; ausente em `paragraph`. */
  itemIndex?: number;
  /** offset (inclusivo) no texto RAW do bloco/item. */
  start: number;
  /** offset (exclusivo) no texto RAW. */
  end: number;
  /** texto-ancora EXATO como aparece no corpo (preserva caixa/acento). */
  anchor: string;
  target: LinkTarget;
}

export interface RelatedBundle {
  produtos: LinkTarget[];
  categorias: LinkTarget[];
  marcas: LinkTarget[];
  /** artigos (mesmo cluster primeiro) + pillar do cluster. */
  leiaTambem: LinkTarget[];
  /** o pillar deste cluster (link "sobe"). */
  pillar?: LinkTarget;
}

export interface BuildResult {
  inline: InlineLink[];
  related: RelatedBundle;
}

/** Entrada do motor: o artigo a processar (corpo + metadados de cluster). */
export interface ArticleInput {
  slug: string;
  titulo: string;
  keywords: string[];
  /** slug do cluster/pillar a que o artigo pertence (best-effort). */
  cluster?: string;
  content: ArticleBlock[];
}

// --- Hrefs por tipo --------------------------------------------------------

function hrefFor(type: LinkTargetType, slug: string): string {
  switch (type) {
    case "produto":
      return `/produto/${slug}`;
    case "categoria":
      return `/catalogo?categoria=${slug}`;
    case "marca":
      return `/marca/${slug}`;
    case "artigo":
      return `/artigos/${slug}`;
    case "cluster":
      return `/guias/${slug}`;
  }
}

function makeTarget(
  type: LinkTargetType,
  id: string,
  slug: string,
  nome: string,
): LinkTarget {
  return {
    type,
    id,
    slug,
    nome,
    href: hrefFor(type, slug),
    prioridade: PRIORIDADE_TIPO[type],
  };
}

// --- Dicionario ------------------------------------------------------------

/** Codigo/modelo e "distintivo" o bastante para virar termo? (ex: "GSB13RE"). */
function isDistinctiveCode(codigo: string | null | undefined): boolean {
  if (!codigo) return false;
  const n = normalizePt(codigo);
  if (n.replace(/\s/g, "").length < LINK_RULES.MIN_TERMO_LEN) return false;
  const hasLetter = /[a-z]/.test(n);
  const hasDigit = /[0-9]/.test(n);
  return hasLetter && hasDigit;
}

/**
 * Constroi o dicionario termo->entidade a partir do catalogo real
 * (marcas/categorias/produtos) + conteudo (artigos/clusters). Best-effort:
 * cada loader ja e tolerante a falha (lib/data / lib/conteudo). Ordena por
 * ngram desc, depois prioridade desc, depois fonte, depois slug (tie-break).
 */
async function buildDictionaryUncached(): Promise<DictEntry[]> {
  const [marcas, categorias, produtosRes, artigos, clusters] =
    await Promise.all([
      safe(() => listMarcas(), []),
      safe(() => listCategorias(), []),
      safe(() => listProdutos({ page: 1 }), { items: [], total: 0 }),
      safe(() => listArtigos(), []),
      safe(() => listClusters(), []),
    ]);

  const entries: DictEntry[] = [];
  const seen = new Set<string>(); // dedup (termo|href): evita entradas identicas

  const push = (
    termoRaw: string,
    target: LinkTarget,
    fonte: DictEntry["fonte"],
  ) => {
    const termo = normalizePt(termoRaw);
    if (termo.length < LINK_RULES.MIN_TERMO_LEN) return; // ruido
    if (STOPTERMS.has(termo)) return; // generico demais
    const key = `${termo}|${target.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      termo,
      ngram: termo.split(" ").filter(Boolean).length,
      target,
      fonte,
    });
  };

  // Marcas: nome (prioridade 1).
  for (const m of marcas) {
    if (!m.slug) continue;
    push(m.nome, makeTarget("marca", m.id, m.slug, m.nome), "nome");
  }

  // Categorias: nome (prioridade 3). href via querystring (id = slug).
  for (const c of categorias) {
    if (!c.slug) continue;
    push(c.nome, makeTarget("categoria", c.slug, c.slug, c.nome), "nome");
  }

  // Produtos: nome + codigo/modelo distintivo (prioridade 5).
  for (const p of produtosRes.items) {
    if (!p.slug) continue;
    const t = makeTarget("produto", p.id, p.slug, p.nome);
    push(p.nome, t, "nome");
    if (isDistinctiveCode(p.codigo)) push(p.codigo, t, "slug");
  }

  // Clusters/pillar: titulo (prioridade 4). href /guias/{slug}.
  for (const cl of clusters) {
    if (!cl.slug) continue;
    push(cl.title, makeTarget("cluster", cl.slug, cl.slug, cl.title), "nome");
  }

  // Artigos: keywords[] + titulo (prioridade 2). href /artigos/{slug}.
  for (const a of artigos) {
    if (!a.slug) continue;
    const t = makeTarget("artigo", a.slug, a.slug, a.title);
    push(a.title, t, "nome");
    for (const kw of a.keywords ?? []) push(kw, t, "keyword");
  }

  // Ordenacao deterministica: n-grama maior primeiro (casa "furadeira de
  // impacto" antes de "furadeira"), depois prioridade por tipo, depois
  // match-de-nome > keyword/sinonimo, depois slug alfabetico (tie-break final).
  const fonteRank = (f: DictEntry["fonte"]) =>
    f === "nome" ? 0 : f === "slug" ? 1 : f === "keyword" ? 2 : 3;
  entries.sort(
    (a, b) =>
      b.ngram - a.ngram ||
      b.target.prioridade - a.target.prioridade ||
      fonteRank(a.fonte) - fonteRank(b.fonte) ||
      cmp(a.target.slug, b.target.slug) ||
      cmp(a.termo, b.termo),
  );
  return entries;
}

/** Comparador de string estavel (-1 | 0 | 1). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Versao cacheada por request (React cache). Ver buildDictionaryUncached. */
export const buildDictionary: () => Promise<DictEntry[]> = cache(
  buildDictionaryUncached,
);

// --- Matching de n-gramas (sobre a forma normalizada alinhada 1:1) ----------

/** True se a posicao `i` em `norm` e inicio de palavra (limite a esquerda). */
function isWordStart(norm: string, i: number): boolean {
  if (i <= 0) return /[a-z0-9]/.test(norm[i] ?? "");
  return norm[i - 1] === " " && /[a-z0-9]/.test(norm[i] ?? "");
}

/** True se a posicao `i` (exclusiva) em `norm` e fim de palavra (limite a direita). */
function isWordEnd(norm: string, i: number): boolean {
  if (i >= norm.length) return true;
  return norm[i] === " ";
}

/** Proximo inicio de palavra a partir de `from` (varredura L->R). */
function nextWordStart(norm: string, from: number): number {
  let i = from;
  while (i < norm.length && norm[i] !== " ") i++; // pula o resto da palavra
  while (i < norm.length && norm[i] === " ") i++; // pula espacos
  return i;
}

/**
 * Compara `termo` (normalizado, espacos simples) com `norm` a partir de `pos`,
 * tolerando multiplos espacos entre palavras de `norm` (a forma alinhada 1:1
 * nao colapsa espacos). Retorna o offset final (exclusivo) em `norm` se casar
 * em limite de palavra a direita, senao -1.
 */
function matchTermAt(norm: string, pos: number, termo: string): number {
  const words = termo.split(" ").filter(Boolean);
  if (words.length === 0) return -1;
  let i = pos;
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    if (!isWordStart(norm, i)) return -1;
    if (norm.substr(i, word.length) !== word) return -1;
    const after = i + word.length;
    if (!isWordEnd(norm, after)) return -1;
    if (w < words.length - 1) {
      let j = after;
      while (j < norm.length && norm[j] === " ") j++;
      if (j === after) return -1; // precisava de 1+ separador
      i = j;
    } else {
      return after;
    }
  }
  return -1;
}

/**
 * Acha a MELHOR entrada do dicionario que casa em `norm` na posicao `pos`.
 * `dict` ja vem ordenado por ngram desc / prioridade desc, entao a primeira
 * que casar em limite de palavra e a vencedora (n-grama maior ganha).
 */
function matchAt(
  norm: string,
  pos: number,
  dict: DictEntry[],
): { entry: DictEntry; normStart: number; normEnd: number } | null {
  if (!isWordStart(norm, pos)) return null;
  for (const entry of dict) {
    const end = matchTermAt(norm, pos, entry.termo);
    if (end !== -1) return { entry, normStart: pos, normEnd: end };
  }
  return null;
}

// --- Varredura do corpo + anti-spam (doc 03 secao 3.3 / 4) ------------------

interface PlacedLink {
  blockIndex: number;
  itemIndex?: number;
  normStart: number;
  normEnd: number;
}

/** Ha link ja colocado dentro da janela de proximidade (mesmo bloco/item)? */
function inProximityWindow(
  placed: PlacedLink[],
  blockIndex: number,
  itemIndex: number | undefined,
  normStart: number,
  wordLen: number,
): boolean {
  const windowChars = LINK_RULES.PROXIMIDADE_PALAVRAS * wordLen;
  for (const p of placed) {
    if (p.blockIndex !== blockIndex || p.itemIndex !== itemIndex) continue;
    if (Math.abs(p.normStart - normStart) < windowChars) return true;
  }
  return false;
}

/** O span [s,e) colide com algum link ja colocado no mesmo bloco/item? */
function overlapsExisting(
  placed: PlacedLink[],
  blockIndex: number,
  itemIndex: number | undefined,
  s: number,
  e: number,
): boolean {
  for (const p of placed) {
    if (p.blockIndex !== blockIndex || p.itemIndex !== itemIndex) continue;
    if (s < p.normEnd && e > p.normStart) return true;
  }
  return false;
}

/** Conta palavras (normalizadas) de todos os blocos de texto. */
function countWords(content: ArticleBlock[]): number {
  let n = 0;
  for (const b of content) {
    if (b.type === "heading") continue;
    const texts = b.type === "list" ? b.items : [b.text];
    for (const t of texts) n += normalizePt(t).split(" ").filter(Boolean).length;
  }
  return n;
}

/**
 * Nucleo do motor. Varre paragraph/list (NUNCA heading), casa n-gramas em limite
 * de palavra sobre a forma normalizada alinhada 1:1, aplica anti-spam e produz
 * links inline (offsets no RAW + ancora real) + bundle de relacionados.
 * Deterministico: mesma entrada -> mesma saida, byte-a-byte.
 *
 * `relatedExtra.produtosTsv` injeta o reforco tsvector (opcional). Para o
 * bundle COMPLETO com pillar/leiaTambem (que exigem I/O), use
 * buildInternalLinksFull.
 */
export function buildInternalLinks(
  article: ArticleInput,
  dict: DictEntry[],
  relatedExtra?: { produtosTsv?: LinkTarget[] },
): BuildResult {
  const selfHref = hrefFor("artigo", article.slug);
  const usedTargets = new Set<string>(); // 1 link por destino (href)
  const usedTermos = new Set<string>(); // 1 link por termo
  const placed: PlacedLink[] = [];
  const inline: InlineLink[] = [];

  // teto escalado pelo tamanho do texto (doc 03 secao 4).
  const palavras = countWords(article.content);
  const maxLinks = Math.min(
    LINK_RULES.MAX_LINKS_TOTAL,
    Math.max(1, Math.floor(palavras / LINK_RULES.PALAVRAS_POR_LINK)),
  );
  const avgWordLen = 6; // chars por palavra (estimativa p/ janela de proximidade)

  for (let b = 0; b < article.content.length; b++) {
    if (inline.length >= maxLinks) break;
    const block = article.content[b];
    if (block.type === "heading") continue; // headings nunca recebem link
    const texts = block.type === "list" ? block.items : [block.text];

    for (let it = 0; it < texts.length; it++) {
      if (inline.length >= maxLinks) break;
      const raw = texts[it];
      const map: NormIndexMap = buildNormIndexMap(raw);
      const itemIndex = block.type === "list" ? it : undefined;

      let cursor = 0;
      while (cursor < map.norm.length && inline.length < maxLinks) {
        const m = matchAt(map.norm, cursor, dict);
        if (!m) {
          cursor = nextWordStart(map.norm, cursor);
          continue;
        }
        const { entry, normStart, normEnd } = m;
        const t = entry.target;

        const skip =
          t.href === selfHref ||
          usedTargets.has(t.href) ||
          usedTermos.has(entry.termo) ||
          inProximityWindow(placed, b, itemIndex, normStart, avgWordLen) ||
          overlapsExisting(placed, b, itemIndex, normStart, normEnd);

        if (skip) {
          cursor = normEnd;
          continue;
        }

        const { start, end } = map.toRaw(normStart, normEnd);
        inline.push({
          blockIndex: b,
          itemIndex,
          start,
          end,
          anchor: raw.slice(start, end),
          target: t,
        });
        placed.push({ blockIndex: b, itemIndex, normStart, normEnd });
        usedTargets.add(t.href);
        usedTermos.add(entry.termo);
        cursor = normEnd;
      }
    }
  }

  const related = scoreRelated(article, dict, inline, relatedExtra);
  return { inline, related };
}

// --- Blocos relacionados ----------------------------------------------------

/**
 * Monta os blocos "relacionados" (NAO exigem o termo no corpo).
 * 1. Sinal forte: produtos/categorias/marcas citados inline entram primeiro.
 * 2. Reforco opcional: produtos vindos do RPC tsvector (relatedExtra), se houver.
 * 3. Categorias/marcas adicionais por keyword do artigo (best-effort, do dict).
 *
 * `leiaTambem`/`pillar` ficam vazios aqui (exigem I/O) e sao preenchidos por
 * resolveLeiaTambem / buildInternalLinksFull. Funcao PURA e deterministica.
 */
export function scoreRelated(
  article: ArticleInput,
  dict: DictEntry[],
  inline: InlineLink[],
  relatedExtra?: { produtosTsv?: LinkTarget[] },
): RelatedBundle {
  const produtos: LinkTarget[] = [];
  const categorias: LinkTarget[] = [];
  const marcas: LinkTarget[] = [];
  const seenP = new Set<string>();
  const seenC = new Set<string>();
  const seenM = new Set<string>();

  const addP = (t: LinkTarget) => {
    if (t.type !== "produto" || seenP.has(t.href)) return;
    seenP.add(t.href);
    produtos.push(t);
  };
  const addC = (t: LinkTarget) => {
    if (t.type !== "categoria" || seenC.has(t.href)) return;
    seenC.add(t.href);
    categorias.push(t);
  };
  const addM = (t: LinkTarget) => {
    if (t.type !== "marca" || seenM.has(t.href)) return;
    seenM.add(t.href);
    marcas.push(t);
  };

  // 1. citados inline (ordem de aparicao = ordem natural do texto).
  for (const l of inline) {
    if (l.target.type === "produto") addP(l.target);
    else if (l.target.type === "categoria") addC(l.target);
    else if (l.target.type === "marca") addM(l.target);
  }

  // 2. reforco tsvector (produtos): completa quando faltam citacoes diretas.
  for (const t of relatedExtra?.produtosTsv ?? []) addP(t);

  // 3. categorias/marcas adicionais por keyword do artigo (do dicionario).
  const kwNorm = new Set(
    (article.keywords ?? []).map((k) => normalizePt(k)).filter(Boolean),
  );
  for (const e of dict) {
    if (categorias.length >= LINK_RULES.MAX_CATEGORIAS) break;
    if (e.target.type === "categoria" && kwNorm.has(e.termo)) addC(e.target);
  }
  for (const e of dict) {
    if (marcas.length >= LINK_RULES.MAX_MARCAS) break;
    if (e.target.type === "marca" && kwNorm.has(e.termo)) addM(e.target);
  }

  return {
    produtos: produtos.slice(0, LINK_RULES.MAX_PRODUTOS_BLOCO),
    categorias: categorias.slice(0, LINK_RULES.MAX_CATEGORIAS),
    marcas: marcas.slice(0, LINK_RULES.MAX_MARCAS),
    leiaTambem: [],
    pillar: undefined,
  };
}

// --- Reforco tsvector (RPC opcional) + pillar/leiaTambem (I/O) ---------------

/**
 * Reforco opcional: busca produtos relevantes ao texto do artigo via RPC SQL
 * `produtos_relevantes_para_texto` (full-text, padrao de recomendar_para_carrinho).
 * Se a migration 0020 nao estiver aplicada / der erro, retorna [] (NUNCA lanca).
 */
export async function produtosRelevantesPorTexto(
  texto: string,
  limite = LINK_RULES.MAX_PRODUTOS_BLOCO,
): Promise<LinkTarget[]> {
  try {
    const sb = getAnonSupabase();
    const { data, error } = await sb.rpc("produtos_relevantes_para_texto", {
      texto,
      limite,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as Array<{ id: string; slug: string; nome: string }>)
      .filter((r) => r && r.slug)
      .map((r) => makeTarget("produto", r.id, r.slug, r.nome));
  } catch {
    return [];
  }
}

/**
 * Resolve "Leia tambem": artigos do MESMO cluster primeiro, depois o pillar do
 * cluster (link "sobe"). Best-effort: usa listArtigos()/listClusters(). Exclui o
 * proprio artigo. NUNCA lanca.
 */
export async function resolveLeiaTambem(article: ArticleInput): Promise<{
  leiaTambem: LinkTarget[];
  pillar?: LinkTarget;
}> {
  try {
    const [artigos, clusters] = await Promise.all([
      safe(() => listArtigos(), []),
      safe(() => listClusters(), []),
    ]);

    const clusterSlug = article.cluster;
    const out: LinkTarget[] = [];
    let pillar: LinkTarget | undefined;

    if (clusterSlug) {
      const cl = clusters.find((c) => c.slug === clusterSlug);
      if (cl) pillar = makeTarget("cluster", cl.slug, cl.slug, cl.title);
    }

    // 1. mesmo cluster (exceto o proprio), ordem de listArtigos (mais recentes).
    const seen = new Set<string>();
    for (const a of artigos) {
      if (out.length >= LINK_RULES.MAX_LEIA_TAMBEM) break;
      if (a.slug === article.slug) continue;
      if (!a.cluster || a.cluster !== clusterSlug) continue;
      const href = hrefFor("artigo", a.slug);
      if (seen.has(href)) continue;
      out.push(makeTarget("artigo", a.slug, a.slug, a.title));
      seen.add(href);
    }

    // 2. completa com outros artigos (clusters irmaos) se ainda houver espaco.
    if (out.length < LINK_RULES.MAX_LEIA_TAMBEM) {
      for (const a of artigos) {
        if (out.length >= LINK_RULES.MAX_LEIA_TAMBEM) break;
        if (a.slug === article.slug) continue;
        const href = hrefFor("artigo", a.slug);
        if (seen.has(href)) continue;
        out.push(makeTarget("artigo", a.slug, a.slug, a.title));
        seen.add(href);
      }
    }

    return { leiaTambem: out, pillar };
  } catch {
    return { leiaTambem: [] };
  }
}

/**
 * Ponto de entrada de alto nivel (save do admin, Fase 3): constroi o dicionario
 * (cacheado), roda o reforco tsvector e a resolucao de pillar/leiaTambem (I/O
 * best-effort) e devolve o BuildResult COMPLETO.
 */
export async function buildInternalLinksFull(
  article: ArticleInput,
): Promise<BuildResult> {
  const dict = await buildDictionary();

  const corpoTexto = article.content
    .flatMap((b) =>
      b.type === "heading" ? [b.text] : b.type === "list" ? b.items : [b.text],
    )
    .join(" ");
  const textoBusca =
    `${article.titulo} ${(article.keywords ?? []).join(" ")} ${corpoTexto}`.trim();

  const [produtosTsv, leia] = await Promise.all([
    produtosRelevantesPorTexto(textoBusca),
    resolveLeiaTambem(article),
  ]);

  const base = buildInternalLinks(article, dict, { produtosTsv });
  return {
    inline: base.inline,
    related: {
      ...base.related,
      leiaTambem: leia.leiaTambem,
      pillar: leia.pillar,
    },
  };
}

// --- Helpers ---------------------------------------------------------------

/** Executa `fn` e devolve `fallback` em qualquer erro (best-effort). */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Cliente Supabase anon (mesmo padrao de lib/data.ts) para o RPC de reforco. */
function getAnonSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
