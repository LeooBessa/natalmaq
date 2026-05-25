"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcaoResult = { ok: boolean; error?: string };

// ============================================================================
// Aprovar / Rejeitar candidatos
// ============================================================================

/**
 * Aprova um candidato: baixa a imagem do Mercado Livre, re-hospeda no Storage
 * próprio (bucket `produtos`) e aplica foto + descrição ao produto.
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

  // Baixa a imagem e re-hospeda no Storage (evita hot-link do CDN do ML).
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
