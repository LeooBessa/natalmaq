"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcaoResult = { ok: boolean; error?: string };

// ============================================================================
// Aprovar / Rejeitar candidatos
// ============================================================================

type CandImg = { produto_id: string; titulo: string | null; imagem_url: string };

/**
 * Baixa a imagem do candidato, re-hospeda no Storage (bucket `produtos`) e aplica
 * foto + (se vazia) descrição ao produto. Helper compartilhado pela aprovação
 * manual e pela automática. NÃO mexe no status do candidato.
 */
async function aplicarImagemAoProduto(
  sb: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cand: CandImg,
): Promise<AcaoResult> {
  let publicUrl: string;
  try {
    const resp = await fetch(cand.imagem_url);
    if (!resp.ok) return { ok: false, error: `Falha ao baixar a imagem (HTTP ${resp.status}).` };
    const buffer = Buffer.from(await resp.arrayBuffer());
    const path = `enriquecimento/${cand.produto_id}-${Date.now()}.jpg`;
    const { error: errUp } = await sb.storage
      .from("produtos")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (errUp) return { ok: false, error: "Falha no upload: " + errUp.message };
    publicUrl = sb.storage.from("produtos").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    return { ok: false, error: "Erro ao processar a imagem: " + (e as Error).message };
  }

  // Aplica ao produto. A descrição só é preenchida se estiver vazia.
  const { data: prod } = await sb
    .from("produtos")
    .select("descricao")
    .eq("id", cand.produto_id)
    .single();
  const update: Record<string, unknown> = { imagens: [publicUrl] };
  if (prod && (!prod.descricao || prod.descricao.trim() === "") && cand.titulo) {
    update.descricao = cand.titulo;
  }
  const { error: errProd } = await sb
    .from("produtos")
    .update(update)
    .eq("id", cand.produto_id);
  if (errProd) return { ok: false, error: "Falha ao atualizar o produto: " + errProd.message };
  return { ok: true };
}

/**
 * Aprova um candidato manualmente: aplica a imagem e marca aprovado
 * (revisado_em = agora, pois já passou por olho humano).
 */
export async function aprovarEnriquecimento(id: string): Promise<AcaoResult> {
  const sb = await createSupabaseServerClient();
  const { data: cand, error: e1 } = await sb
    .from("produto_enriquecimento")
    .select("id, produto_id, titulo, imagem_url, status")
    .eq("id", id)
    .single();
  if (e1 || !cand) return { ok: false, error: "Candidato não encontrado." };
  if (cand.status !== "pendente") return { ok: false, error: "Candidato já revisado." };

  const r = await aplicarImagemAoProduto(sb, cand);
  if (!r.ok) return r;

  await sb
    .from("produto_enriquecimento")
    .update({ status: "aprovado", revisado_em: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/enriquecimento");
  return { ok: true };
}

/** Rejeita um candidato (não altera o produto). */
export async function rejeitarEnriquecimento(id: string): Promise<AcaoResult> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("produto_enriquecimento")
    .update({ status: "rejeitado", revisado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/enriquecimento");
  return { ok: true };
}

// ============================================================================
// Busca de candidatos no Mercado Livre (em lotes, disparada pelo painel)
// ============================================================================

// LOTE = 8 cabe em ~7s e respeita o hard cap de 10s do plano Vercel Hobby
// pra Server Actions. Aumentar só após migrar pro Pro (60s) ou pra cron Python.
const LOTE = 8;
const MIN_SCORE = 35;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 2);
}

// Mede o quanto o nome do produto do ML cobre as palavras do nosso produto.
function calcularScore(nomeProduto: string, marca: string, nomeML: string): number {
  const pt = [...new Set(tokenize(nomeProduto))];
  const tt = new Set(tokenize(nomeML));
  if (pt.length === 0 || tt.size === 0) return 0;
  let comuns = 0;
  for (const t of pt) if (tt.has(t)) comuns++;
  let s = (comuns / pt.length) * 100;
  const mt = tokenize(marca);
  if (mt.length > 0 && mt.every((t) => tt.has(t))) s += 15;
  return Math.min(100, Math.round(s * 10) / 10);
}

async function obterTokenML(appId: string, secret: string): Promise<string> {
  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: appId,
      client_secret: secret,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error("Falha ao autenticar no Mercado Livre.");
  }
  return data.access_token as string;
}

type MLResult = {
  id: string;
  name: string;
  pictures?: { url: string }[];
};

async function buscarNoML(token: string, query: string): Promise<MLResult[]> {
  const url = `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(query)}&limit=10`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.results || []) as MLResult[];
}

export type LoteResult = {
  ok: boolean;
  processados: number;
  comCandidato: number;
  ultimoId: string | null;
  fim: boolean;
  error?: string;
};

/**
 * Processa um lote de produtos sem foto: busca cada um no catálogo do Mercado
 * Livre e grava o melhor candidato. Usa cursor por `id` — o painel chama em
 * sequência passando o `ultimoId` retornado.
 */
export async function processarLoteEnriquecimento(
  afterId: string | null,
): Promise<LoteResult> {
  const appId = process.env.ML_APP_ID;
  const secret = process.env.ML_APP_SECRET;
  if (!appId || !secret) {
    return {
      ok: false,
      processados: 0,
      comCandidato: 0,
      ultimoId: afterId,
      fim: true,
      error: "Credenciais do Mercado Livre (ML_APP_ID/ML_APP_SECRET) não configuradas.",
    };
  }

  const sb = await createSupabaseServerClient();

  // Próximos produtos sem foto, ordenados por id (cursor).
  let q = sb
    .from("produtos")
    .select("id, codigo, nome, marca:marcas(nome)")
    .or("imagens.is.null,imagens.eq.[]")
    .order("id", { ascending: true })
    .limit(LOTE);
  if (afterId) q = q.gt("id", afterId);

  const { data: prods, error } = await q;
  if (error) {
    return { ok: false, processados: 0, comCandidato: 0, ultimoId: afterId, fim: true, error: error.message };
  }
  const produtos = (prods ?? []) as unknown as Array<{
    id: string;
    codigo: string;
    nome: string;
    marca: { nome: string } | null;
  }>;
  if (produtos.length === 0) {
    return { ok: true, processados: 0, comCandidato: 0, ultimoId: afterId, fim: true };
  }

  // Pula produtos que já têm candidato (idempotência se reprocessar).
  const ids = produtos.map((p) => p.id);
  const { data: jaTem } = await sb
    .from("produto_enriquecimento")
    .select("produto_id")
    .in("produto_id", ids);
  const jaSet = new Set((jaTem ?? []).map((r) => r.produto_id));

  let token: string;
  try {
    token = await obterTokenML(appId, secret);
  } catch (e) {
    return { ok: false, processados: 0, comCandidato: 0, ultimoId: afterId, fim: true, error: (e as Error).message };
  }

  const novos: Record<string, unknown>[] = [];
  for (const p of produtos) {
    if (jaSet.has(p.id)) continue;
    const marca = p.marca?.nome ?? "";
    const query = `${marca} ${p.nome}`.trim().slice(0, 120);

    let resultados: MLResult[] = [];
    try {
      resultados = await buscarNoML(token, query);
    } catch {
      resultados = [];
    }

    let melhor: { r: MLResult; img: string; score: number } | null = null;
    for (const r of resultados) {
      const img = r.pictures?.[0]?.url;
      if (!img) continue;
      const s = calcularScore(p.nome, marca, r.name);
      if (!melhor || s > melhor.score) melhor = { r, img, score: s };
    }

    if (melhor && melhor.score >= MIN_SCORE) {
      novos.push({
        produto_id: p.id,
        fonte: "mercadolivre",
        ml_item_id: melhor.r.id,
        titulo: melhor.r.name,
        imagem_url: melhor.img,
        url_origem: `https://www.mercadolivre.com.br/p/${melhor.r.id}`,
        preco_origem: null,
        score: melhor.score,
        status: "pendente",
      });
    }
    await sleep(60);
  }

  if (novos.length > 0) {
    await sb
      .from("produto_enriquecimento")
      .upsert(novos, { onConflict: "produto_id", ignoreDuplicates: true });
  }

  const ultimoId = produtos[produtos.length - 1].id;
  return {
    ok: true,
    processados: produtos.length,
    comCandidato: novos.length,
    ultimoId,
    fim: produtos.length < LOTE,
  };
}

// ============================================================================
// Auto-aprovação (imagem única + score) + reprovação de genéricos
// ============================================================================

// Imagem = download + upload por item (mais lento que a busca). Lote pequeno
// p/ caber no limite de Server Action; o painel chama em sequência.
const LOTE_AUTO = 5;
// Cobertura mínima do nome p/ auto-aprovar um candidato de imagem ÚNICA.
const LIMITE_SCORE_AUTO = 60;

/**
 * Auto-processa um lote de candidatos PENDENTES:
 *  - imagem REPETIDA (mesma foto em 2+ produtos) → reprovado: é match genérico,
 *    quase sempre errado (ex.: 1 foto de polia em 13 polias diferentes);
 *  - imagem ÚNICA e score >= LIMITE_SCORE_AUTO → aprovado (aplica a foto,
 *    revisado_em=NULL → cai na tela de Revisão p/ conferência visual);
 *  - imagem única mas score baixo → fica pendente (revisão manual).
 * Cursor por id; o painel chama em sequência passando o ultimoId.
 */
export async function autoAprovarLote(afterId: string | null): Promise<{
  ok: boolean;
  processados: number;
  aprovados: number;
  reprovados: number;
  ultimoId: string | null;
  fim: boolean;
  error?: string;
}> {
  const sb = await createSupabaseServerClient();
  let q = sb
    .from("produto_enriquecimento")
    .select("id, produto_id, titulo, imagem_url, score")
    .eq("status", "pendente")
    .order("id", { ascending: true })
    .limit(LOTE_AUTO);
  if (afterId) q = q.gt("id", afterId);

  const { data, error } = await q;
  if (error) return { ok: false, processados: 0, aprovados: 0, reprovados: 0, ultimoId: afterId, fim: true, error: error.message };

  const cands = (data ?? []) as Array<{
    id: string;
    produto_id: string;
    titulo: string | null;
    imagem_url: string;
    score: number;
  }>;
  if (cands.length === 0) return { ok: true, processados: 0, aprovados: 0, reprovados: 0, ultimoId: afterId, fim: true };

  // Quantos produtos no total (qualquer status) usam cada imagem deste lote?
  // 2+ = foto genérica reaplicada → reprova. Conta sem filtrar status p/ o
  // resultado não mudar conforme o lote vai reprovando os irmãos.
  const urls = [...new Set(cands.map((c) => c.imagem_url))];
  const { data: irmaos } = await sb
    .from("produto_enriquecimento")
    .select("imagem_url")
    .in("imagem_url", urls);
  const usos = new Map<string, number>();
  for (const r of irmaos ?? []) usos.set(r.imagem_url, (usos.get(r.imagem_url) ?? 0) + 1);

  let aprovados = 0;
  let reprovados = 0;
  for (const c of cands) {
    if ((usos.get(c.imagem_url) ?? 0) > 1) {
      await sb
        .from("produto_enriquecimento")
        .update({ status: "rejeitado", revisado_em: new Date().toISOString() })
        .eq("id", c.id);
      reprovados++;
      continue;
    }
    if ((c.score ?? 0) < LIMITE_SCORE_AUTO) continue; // única mas fraca → manual
    const r = await aplicarImagemAoProduto(sb, c);
    if (!r.ok) continue; // imagem quebrada etc. → deixa pendente
    await sb
      .from("produto_enriquecimento")
      .update({ status: "aprovado", revisado_em: null })
      .eq("id", c.id);
    aprovados++;
  }

  const ultimoId = cands[cands.length - 1].id;
  revalidatePath("/admin/enriquecimento");
  return { ok: true, processados: cands.length, aprovados, reprovados, ultimoId, fim: cands.length < LOTE_AUTO };
}

/** Confirma um auto-aprovado (humano olhou e está OK) → sai da revisão. */
export async function confirmarEnriquecimento(id: string): Promise<AcaoResult> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("produto_enriquecimento")
    .update({ revisado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "aprovado");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/enriquecimento");
  return { ok: true };
}

/** Confirma vários auto-aprovados de uma vez (todos saem da revisão). */
export async function confirmarVarios(ids: string[]): Promise<AcaoResult> {
  if (ids.length === 0) return { ok: true };
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("produto_enriquecimento")
    .update({ revisado_em: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "aprovado");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/enriquecimento");
  return { ok: true };
}

/** Remove a foto auto-aprovada (estava errada): limpa a imagem do produto e rejeita. */
export async function removerEnriquecimentoAprovado(id: string): Promise<AcaoResult> {
  const sb = await createSupabaseServerClient();
  const { data: cand } = await sb
    .from("produto_enriquecimento")
    .select("produto_id")
    .eq("id", id)
    .single();
  if (!cand) return { ok: false, error: "Candidato não encontrado." };
  await sb.from("produtos").update({ imagens: [] }).eq("id", cand.produto_id);
  await sb
    .from("produto_enriquecimento")
    .update({ status: "rejeitado", revisado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/enriquecimento");
  return { ok: true };
}

/** Troca a foto do produto por uma enviada manualmente (URL já no Storage). */
export async function trocarImagemEnriquecimento(id: string, novaUrl: string): Promise<AcaoResult> {
  const sb = await createSupabaseServerClient();
  if (!novaUrl) return { ok: false, error: "URL inválida." };
  const { data: cand } = await sb
    .from("produto_enriquecimento")
    .select("produto_id")
    .eq("id", id)
    .single();
  if (!cand) return { ok: false, error: "Candidato não encontrado." };
  await sb.from("produtos").update({ imagens: [novaUrl] }).eq("id", cand.produto_id);
  await sb
    .from("produto_enriquecimento")
    .update({ revisado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/enriquecimento");
  return { ok: true };
}
