import "server-only";

import type { BuildResult, InlineLink, LinkTarget } from "./internal-links";

// ============================================================================
// PERSISTENCIA do resultado do motor de linkagem (doc 03 secao 5.2 / 7.1).
//
// Usado na FASE 3 (save do artigo no admin). NAO chamar agora. Grava o resultado
// materializado:
//   - artigos.links_inline   (JSONB) = InlineLink[]            -> fonte do render
//   - artigos.relacionados   (JSONB) = RelatedBundle           -> fonte do render
//   - artigos.links_geradoem (timestamptz)
//   - artigo_links (tabela-grafo): delete+insert das arestas   -> sitemap/metricas
//
// REGRA DE BUILD: as tabelas/colunas vivem na migration 0020 (NAO aplicada no
// build). TODA operacao e try/catch e NUNCA lanca: se a coluna/tabela nao existir,
// o save do artigo continua funcionando (apenas os links nao sao materializados).
// ============================================================================

/**
 * Contrato minimo do client Supabase necessario aqui. Aceita tanto o client
 * SSR (createSupabaseServerClient) quanto o anon/admin (createClient) sem acoplar
 * aos tipos gerados. So usa `.from(table)` com os metodos encadeados padrao.
 */
export interface SupabaseLike {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: unknown }>;
    };
    delete(): {
      eq(column: string, value: unknown): Promise<{ error: unknown }>;
    };
    insert(values: readonly object[]): Promise<{ error: unknown }>;
  };
}

/** Contexto de uma aresta no grafo `artigo_links` (doc 03 secao 5.2). */
type LinkContexto =
  | "inline"
  | "produtos"
  | "categorias"
  | "marcas"
  | "leia_tambem"
  | "pillar";

interface ArtigoLinkRow {
  artigo_id: string;
  target_type: LinkTarget["type"];
  target_id: string | null;
  target_slug: string;
  target_href: string;
  contexto: LinkContexto;
  anchor: string | null;
  posicao: number;
}

/**
 * `categoria` usa slug em querystring (sem uuid). Demais tipos guardam o id real
 * quando ele e um uuid (produto/marca/artigo/cluster). Heuristica: se o id nao
 * parece uuid, grava null (a tabela permite target_id null).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function targetIdOrNull(t: LinkTarget): string | null {
  return UUID_RE.test(t.id) ? t.id : null;
}

function inlineRow(
  artigoId: string,
  l: InlineLink,
  posicao: number,
): ArtigoLinkRow {
  return {
    artigo_id: artigoId,
    target_type: l.target.type,
    target_id: targetIdOrNull(l.target),
    target_slug: l.target.slug,
    target_href: l.target.href,
    contexto: "inline",
    anchor: l.anchor,
    posicao,
  };
}

function relatedRow(
  artigoId: string,
  t: LinkTarget,
  contexto: LinkContexto,
  posicao: number,
): ArtigoLinkRow {
  return {
    artigo_id: artigoId,
    target_type: t.type,
    target_id: targetIdOrNull(t),
    target_slug: t.slug,
    target_href: t.href,
    contexto,
    anchor: null,
    posicao,
  };
}

/** Aplana o BuildResult em linhas de `artigo_links` (1 linha por aresta). */
export function toArtigoLinkRows(
  artigoId: string,
  result: BuildResult,
): ArtigoLinkRow[] {
  const rows: ArtigoLinkRow[] = [];

  result.inline.forEach((l, i) => rows.push(inlineRow(artigoId, l, i)));

  const { produtos, categorias, marcas, leiaTambem, pillar } = result.related;
  produtos.forEach((t, i) => rows.push(relatedRow(artigoId, t, "produtos", i)));
  categorias.forEach((t, i) =>
    rows.push(relatedRow(artigoId, t, "categorias", i)),
  );
  marcas.forEach((t, i) => rows.push(relatedRow(artigoId, t, "marcas", i)));
  leiaTambem.forEach((t, i) =>
    rows.push(relatedRow(artigoId, t, "leia_tambem", i)),
  );
  if (pillar) rows.push(relatedRow(artigoId, pillar, "pillar", 0));

  return rows;
}

/**
 * Grava o resultado do motor para um artigo. Best-effort: cada passo e try/catch
 * e NUNCA lanca. Retorna `{ ok, errors }` para diagnostico (o save nao deve
 * abortar so porque a coluna/tabela de links ainda nao existe).
 *
 * NAO chamar na Fase 2 (este e o contrato para o save do admin na Fase 3).
 *
 * @param sb        client Supabase (SSR ou admin) com permissao de escrita.
 * @param artigoId  uuid do artigo (artigos.id).
 * @param result    saida de buildInternalLinks / buildInternalLinksFull.
 */
export async function persistLinks(
  sb: SupabaseLike,
  artigoId: string,
  result: BuildResult,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Colunas JSONB na propria tabela artigos (fonte do render).
  try {
    const { error } = await sb
      .from("artigos")
      .update({
        links_inline: result.inline,
        relacionados: result.related,
        links_geradoem: new Date().toISOString(),
      })
      .eq("id", artigoId);
    if (error) errors.push(`artigos.update: ${errMsg(error)}`);
  } catch (e) {
    errors.push(`artigos.update: ${errMsg(e)}`);
  }

  // 2. Grafo artigo_links: delete + insert (substitui as arestas do artigo).
  try {
    const { error: delErr } = await sb
      .from("artigo_links")
      .delete()
      .eq("artigo_id", artigoId);
    if (delErr) errors.push(`artigo_links.delete: ${errMsg(delErr)}`);

    const rows = toArtigoLinkRows(artigoId, result);
    if (rows.length > 0) {
      const { error: insErr } = await sb.from("artigo_links").insert(rows);
      if (insErr) errors.push(`artigo_links.insert: ${errMsg(insErr)}`);
    }
  } catch (e) {
    errors.push(`artigo_links: ${errMsg(e)}`);
  }

  return { ok: errors.length === 0, errors };
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
