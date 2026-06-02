"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "../_lib/slug";

// faq do banco usa o shape [{ pergunta, resposta }] (migration 0019); o editor
// (FaqRepeater) trabalha com { question, answer }. A conversão acontece aqui no
// save e na page.tsx na leitura.
type FaqDb = { pergunta: string; resposta: string };

function parseFaq(raw: string): FaqDb[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => {
        const o = it as Record<string, unknown>;
        const pergunta = String(o?.pergunta ?? o?.question ?? "").trim();
        const resposta = String(o?.resposta ?? o?.answer ?? "").trim();
        return { pergunta, resposta };
      })
      .filter((f) => f.pergunta && f.resposta);
  } catch {
    return [];
  }
}

const STATUS = new Set(["rascunho", "publicado", "arquivado"]);

function revalidarCluster(slug?: string | null) {
  revalidatePath("/admin/seo/clusters");
  revalidatePath("/guias");
  if (slug) {
    revalidatePath(`/guias/${slug}`);
  }
  // Tag forward-compat: quando as leituras públicas adotarem cache tags por
  // cluster, este invalida sem precisar mudar a action.
  revalidateTag("clusters");
}

export async function saveClusterAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const titulo = String(formData.get("titulo") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(titulo);
  const subtitulo = String(formData.get("subtitulo") ?? "").trim() || null;
  const intro = String(formData.get("intro") ?? "").trim() || null;
  const meta_title = String(formData.get("meta_title") ?? "").trim() || null;
  const meta_description =
    String(formData.get("meta_description") ?? "").trim() || null;
  const artigo_pilar_id =
    String(formData.get("artigo_pilar_id") ?? "").trim() || null;
  const ordem = Number(formData.get("ordem") ?? 0) || 0;
  const statusRaw = String(formData.get("status") ?? "rascunho").trim();
  const status = STATUS.has(statusRaw) ? statusRaw : "rascunho";
  const faq = parseFaq(String(formData.get("faq") ?? ""));

  if (!titulo) return { error: "Título obrigatório." };
  if (!slug) return { error: "Slug inválido." };

  const sb = await createSupabaseServerClient();

  const payload = {
    slug,
    titulo,
    subtitulo,
    intro,
    meta_title,
    meta_description,
    artigo_pilar_id,
    ordem,
    status,
    faq,
    updated_at: new Date().toISOString(),
    // published_at: marca a primeira publicação (best-effort; não regrava se já publicado).
    ...(status === "publicado" ? { published_at: new Date().toISOString() } : {}),
  };

  const { error } = id
    ? await sb.from("clusters").update(payload).eq("id", id)
    : await sb.from("clusters").insert(payload);

  if (error) {
    // Migration 0019 ainda não aplicada / tabela ausente: erro amigável.
    if (/relation .*clusters.* does not exist/i.test(error.message)) {
      return {
        error:
          "Tabela de clusters ainda não existe. Aplique a migration 0019 antes de salvar.",
      };
    }
    return { error: error.message };
  }

  revalidarCluster(slug);
  return { ok: true };
}

export async function deleteClusterAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const sb = await createSupabaseServerClient();

  // Pega o slug antes de apagar para revalidar a rota pública correspondente.
  const { data: row } = await sb
    .from("clusters")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb.from("clusters").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidarCluster((row as { slug?: string } | null)?.slug ?? null);
  return { ok: true };
}
