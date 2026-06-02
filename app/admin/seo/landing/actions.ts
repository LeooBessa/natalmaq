"use server";

// Server actions das Landing pages (Conteúdo / SEO — Fase 3).
// Cliente AUTENTICADO via cookies (RLS is_admin aplica). Molde:
// app/admin/produtos/actions.ts. Tudo try/catch-safe: se a tabela
// landing_pages ainda não existir (migration 0019 não aplicada), retornamos
// erro amigável em vez de quebrar.

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "../_lib/slug";

type Result = { ok: true } | { error: string };

const STATUS = new Set(["rascunho", "publicado", "arquivado"]);

/** Parse seguro de um JSON enviado em hidden input. Volta ao fallback se inválido. */
function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** uuid[] a partir de um hidden input JSON (produtos_destaque). */
function parseUuidArray(value: FormDataEntryValue | null): string[] {
  const arr = parseJson<unknown>(value, []);
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/** Campo uuid opcional: "" → null (FKs aceitam null). */
function uuidOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

type LandingPayload = {
  slug: string;
  titulo: string;
  subtitulo: string | null;
  cidade: string | null;
  uf: string | null;
  publico: string | null;
  corpo: unknown[];
  hero_imagem: string | null;
  categoria_id: string | null;
  marca_id: string | null;
  cluster_id: string | null;
  produtos_destaque: string[];
  meta_title: string | null;
  meta_description: string | null;
  faq: unknown[];
  status: string;
  published_at: string | null;
};

function parseForm(formData: FormData): LandingPayload {
  const titulo = str(formData.get("titulo"));
  const slugRaw = str(formData.get("slug"));
  const status = (() => {
    const s = str(formData.get("status"));
    return STATUS.has(s) ? s : "rascunho";
  })();

  return {
    slug: slugify(slugRaw || titulo),
    titulo,
    subtitulo: str(formData.get("subtitulo")) || null,
    cidade: str(formData.get("cidade")) || null,
    uf: str(formData.get("uf")) || null,
    publico: str(formData.get("publico")) || null,
    corpo: parseJson<unknown[]>(formData.get("corpo"), []),
    hero_imagem: str(formData.get("hero_imagem")) || null,
    categoria_id: uuidOrNull(formData.get("categoria_id")),
    marca_id: uuidOrNull(formData.get("marca_id")),
    cluster_id: uuidOrNull(formData.get("cluster_id")),
    produtos_destaque: parseUuidArray(formData.get("produtos_destaque")),
    meta_title: str(formData.get("meta_title")) || null,
    meta_description: str(formData.get("meta_description")) || null,
    faq: parseJson<unknown[]>(formData.get("faq"), []),
    status,
    // published_at é definido na 1ª publicação (mantido se já publicado).
    published_at: status === "publicado" ? new Date().toISOString() : null,
  };
}

function revalidate(slug?: string) {
  revalidatePath("/admin/seo/landing");
  revalidatePath("/solucoes");
  if (slug) revalidatePath(`/solucoes/${slug}`);
  revalidateTag("landing-pages");
}

/** Mensagem amigável quando a migration 0019 ainda não foi aplicada. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("landing_pages") &&
    (m.includes("does not exist") || m.includes("relation") || m.includes("schema cache"))
  ) {
    return "A tabela de landing pages ainda não existe (aplique a migration 0019).";
  }
  return message;
}

export async function createLandingAction(_prev: unknown, formData: FormData) {
  const titulo = str(formData.get("titulo"));
  if (!titulo) return { error: "O título é obrigatório." };

  const sb = await createSupabaseServerClient();
  const data = parseForm(formData);

  let novoId: string | null = null;
  try {
    const { data: novo, error } = await sb
      .from("landing_pages")
      .insert(data)
      .select("id")
      .single();
    if (error) return { error: friendlyError(error.message) };
    novoId = (novo as { id: string }).id;
  } catch (e) {
    return { error: friendlyError(e instanceof Error ? e.message : String(e)) };
  }

  revalidate(data.slug);
  redirect(`/admin/seo/landing/${novoId}`);
}

export async function updateLandingAction(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<Result> {
  const titulo = str(formData.get("titulo"));
  if (!titulo) return { error: "O título é obrigatório." };

  const sb = await createSupabaseServerClient();
  const data = parseForm(formData);

  try {
    // Preserva published_at original quando já publicado (não re-carimba a data).
    const update: Partial<LandingPayload> = { ...data };
    if (data.status === "publicado") {
      const { data: atual } = await sb
        .from("landing_pages")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      const jaPublicado = (atual as { published_at: string | null } | null)?.published_at;
      if (jaPublicado) update.published_at = jaPublicado;
    }

    const { error } = await sb.from("landing_pages").update(update).eq("id", id);
    if (error) return { error: friendlyError(error.message) };
  } catch (e) {
    return { error: friendlyError(e instanceof Error ? e.message : String(e)) };
  }

  revalidate(data.slug);
  return { ok: true };
}

export async function setStatusLandingAction(
  id: string,
  status: "rascunho" | "publicado" | "arquivado",
): Promise<Result> {
  if (!STATUS.has(status)) return { error: "Status inválido." };
  const sb = await createSupabaseServerClient();

  try {
    const patch: { status: string; published_at?: string } = { status };
    if (status === "publicado") {
      const { data: atual } = await sb
        .from("landing_pages")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      const jaPublicado = (atual as { published_at: string | null } | null)?.published_at;
      patch.published_at = jaPublicado ?? new Date().toISOString();
    }
    const { error } = await sb.from("landing_pages").update(patch).eq("id", id);
    if (error) return { error: friendlyError(error.message) };
  } catch (e) {
    return { error: friendlyError(e instanceof Error ? e.message : String(e)) };
  }

  revalidate();
  return { ok: true };
}

export async function deleteLandingAction(id: string): Promise<Result> {
  const sb = await createSupabaseServerClient();
  try {
    const { error } = await sb.from("landing_pages").delete().eq("id", id);
    if (error) return { error: friendlyError(error.message) };
  } catch (e) {
    return { error: friendlyError(e instanceof Error ? e.message : String(e)) };
  }
  revalidate();
  redirect("/admin/seo/landing");
}
