"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveVagaAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim() || null;
  const local = String(formData.get("local") ?? "").trim() || null;
  const ordem = Number(formData.get("ordem") ?? 0) || 0;
  const ativo = formData.get("ativo") === "on";

  if (!titulo) return { error: "Título obrigatório." };

  const sb = await createSupabaseServerClient();
  const payload = { titulo, descricao, tipo, local, ordem, ativo };
  const { error } = id
    ? await sb.from("vagas").update(payload).eq("id", id)
    : await sb.from("vagas").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/admin/vagas");
  revalidatePath("/institucional");
  return { ok: true };
}

export async function deleteVagaAction(id: string) {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("vagas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/vagas");
  revalidatePath("/institucional");
  return { ok: true };
}

/**
 * Cria um banner (carrossel da home) a partir de uma vaga: imagem enviada pelo
 * admin, título derivado da vaga e link já apontando pra seção de vagas do
 * institucional. Reaproveita a mesma tabela `banners`.
 */
export async function criarBannerDaVagaAction(
  vagaTitulo: string,
  imagemUrl: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!imagemUrl) return { error: "Envie a imagem do banner." };
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("banners").insert({
    titulo: `Vaga: ${vagaTitulo}`.slice(0, 200),
    imagem_url: imagemUrl,
    link: "/institucional#vagas",
    ordem: 0,
    ativo: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true };
}
