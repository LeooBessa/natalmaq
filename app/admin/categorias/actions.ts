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

export async function saveCategoriaAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const nome = String(formData.get("nome") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(nome);
  const parent_id = String(formData.get("parent_id") ?? "").trim() || null;
  const ordem = Number(formData.get("ordem") ?? 0) || 0;

  if (!nome) return { error: "Nome obrigatório." };

  const sb = await createSupabaseServerClient();
  const payload = { nome, slug, parent_id, ordem };
  const { error } = id
    ? await sb.from("categorias").update(payload).eq("id", id)
    : await sb.from("categorias").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/admin/categorias");
  return { ok: true };
}

export async function deleteCategoriaAction(id: string) {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("categorias").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categorias");
  return { ok: true };
}
