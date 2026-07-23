"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function n(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const x = Number(String(value).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

type ProdutoForm = {
  codigo: string;
  nome: string;
  slug?: string;
  descricao?: string | null;
  marca_id?: string | null;
  categoria_id?: string | null;
  preco: number;
  preco_promocional?: number | null;
  promo_travada: boolean;
  estoque: number;
  peso_kg: number;
  ativo: boolean;
  destaque: boolean;
  imagens: string[];
};

function parseForm(formData: FormData): ProdutoForm {
  const nome = String(formData.get("nome") ?? "").trim();
  const precoPromocional = n(formData.get("preco_promocional"));
  // Trava = admin é dono da promoção; o sync do DS não sobrescreve.
  // Digitou um valor => trava (é o caso mais comum, "minha promoção tem que
  // ficar"). Deixou vazio => trava só se marcou a caixa explicitamente
  // (serve pra fixar "sem promoção" e barrar promoção-lixo vinda do DS).
  const promoTravada =
    precoPromocional !== null || formData.get("promo_travada") === "on";
  return {
    codigo: String(formData.get("codigo") ?? "").trim(),
    nome,
    slug: String(formData.get("slug") ?? "").trim() || slugify(nome),
    descricao: (String(formData.get("descricao") ?? "").trim() || null),
    marca_id: (String(formData.get("marca_id") ?? "").trim() || null),
    categoria_id: (String(formData.get("categoria_id") ?? "").trim() || null),
    preco: n(formData.get("preco")) ?? 0,
    preco_promocional: precoPromocional,
    promo_travada: promoTravada,
    estoque: Math.max(0, Math.floor(n(formData.get("estoque")) ?? 0)),
    peso_kg: n(formData.get("peso_kg")) ?? 0,
    ativo: formData.get("ativo") === "on",
    destaque: formData.get("destaque") === "on",
    imagens: String(formData.get("imagens") ?? "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// Promoção só faz sentido se for MENOR que o preço — senão não há desconto e
// a loja (corretamente) não mostra nada, o que parece "não funcionou".
function validarPromo(data: ProdutoForm): string | null {
  if (
    data.preco_promocional != null &&
    data.preco_promocional >= data.preco
  ) {
    return "O preço promocional precisa ser MENOR que o preço normal. Deixe em branco se não houver promoção.";
  }
  return null;
}

// A promoção/estoque salvos precisam aparecer na loja na hora. A action só
// revalidava o admin, então a vitrine só atualizava quando o ISR (60s) vencia
// — e o cliente, olhando na hora, achava que não salvou.
function revalidarLoja(slug?: string) {
  revalidatePath("/");
  revalidatePath("/catalogo");
  if (slug) revalidatePath(`/produto/${slug}`);
}

export async function createProdutoAction(_prev: unknown, formData: FormData) {
  const sb = await createSupabaseServerClient();
  const data = parseForm(formData);
  if (!data.codigo || !data.nome) return { error: "Código e nome são obrigatórios." };
  const erroPromo = validarPromo(data);
  if (erroPromo) return { error: erroPromo };

  const { error, data: novo } = await sb
    .from("produtos")
    .insert(data)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin/produtos");
  revalidarLoja(data.slug);
  redirect(`/admin/produtos/${novo.id}`);
}

export async function updateProdutoAction(
  id: string,
  _prev: unknown,
  formData: FormData,
) {
  const sb = await createSupabaseServerClient();
  const data = parseForm(formData);
  const erroPromo = validarPromo(data);
  if (erroPromo) return { error: erroPromo };

  const { error } = await sb.from("produtos").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}`);
  revalidarLoja(data.slug);
  return { ok: true };
}

export async function deleteProdutoAction(id: string) {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("produtos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/produtos");
  revalidarLoja();
  redirect("/admin/produtos");
}

export async function uploadImagemAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };

  const sb = await createSupabaseServerClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await sb.storage
    .from("produtos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };

  const { data } = sb.storage.from("produtos").getPublicUrl(path);
  return { url: data.publicUrl };
}
