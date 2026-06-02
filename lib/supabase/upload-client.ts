"use client";

import { createSupabaseBrowserClient } from "./client";

// Upload de imagem DIRETO do navegador para o Supabase Storage.
//
// POR QUE NÃO via Server Action: a Vercel limita o corpo de uma function a
// ~4.5MB, então uploads por Server Action falham com fotos comuns (ex.: 4.6MB)
// ANTES de chegar no nosso código. O upload direto navegador->Supabase não tem
// esse teto e usa a sessão do usuário (a RLS is_admin() do bucket cuida da
// permissão de escrita). Mesma assinatura de retorno do antigo uploadParaBucket.

const MAX_MB = 10;

export async function uploadDireto(
  bucket: "produtos" | "marketing" | "conteudo",
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (file.size > MAX_MB * 1024 * 1024) {
    return { error: `Imagem maior que ${MAX_MB}MB. Reduza o arquivo.` };
  }
  try {
    const sb = createSupabaseBrowserClient();
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: error.message };
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (err) {
    return { error: (err as { message?: string })?.message ?? "Falha no upload" };
  }
}
