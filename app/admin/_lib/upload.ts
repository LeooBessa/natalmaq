"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function uploadParaBucket(
  bucket: "produtos" | "marketing",
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (file.size > 5 * 1024 * 1024) return { error: "Imagem maior que 5MB" };

  const sb = await createSupabaseServerClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await sb.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };

  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}
