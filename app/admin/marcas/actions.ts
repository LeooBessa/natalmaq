"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function saveMarcaAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const nome = String(formData.get("nome") ?? "").trim();
  const slug =
    String(formData.get("slug") ?? "").trim() || slugify(nome);
  const logo_url = String(formData.get("logo_url") ?? "").trim() || null;
  const ordem = Number(formData.get("ordem") ?? 0) || 0;
  const ativo = formData.get("ativo") === "on";

  if (!nome || !slug) return { error: "Nome e slug obrigatórios." };

  const sb = await createSupabaseServerClient();
  const payload = { nome, slug, logo_url, ordem, ativo };

  const { error } = id
    ? await sb.from("marcas").update(payload).eq("id", id)
    : await sb.from("marcas").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/admin/marcas");
  return { ok: true };
}

export async function deleteMarcaAction(id: string) {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("marcas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/marcas");
  return { ok: true };
}
