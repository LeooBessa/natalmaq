"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcaoResult = { ok: boolean; error?: string };

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
