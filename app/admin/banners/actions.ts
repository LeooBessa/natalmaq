"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveBannerAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const titulo = String(formData.get("titulo") ?? "").trim() || null;
  const imagem_url = String(formData.get("imagem_url") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim() || null;
  const ordem = Number(formData.get("ordem") ?? 0) || 0;
  const ativo = formData.get("ativo") === "on";
  const inicia_em = String(formData.get("inicia_em") ?? "") || null;
  const termina_em = String(formData.get("termina_em") ?? "") || null;

  if (!imagem_url) return { error: "Imagem obrigatória." };

  const sb = await createSupabaseServerClient();
  const payload = {
    titulo,
    imagem_url,
    link,
    ordem,
    ativo,
    inicia_em,
    termina_em,
  };

  const { error } = id
    ? await sb.from("banners").update(payload).eq("id", id)
    : await sb.from("banners").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteBannerAction(id: string) {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("banners").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true };
}
