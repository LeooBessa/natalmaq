"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CupomFormData = {
  codigo: string;
  descricao: string;
  tipo: "percentual" | "fixo";
  valor: number;
  valor_minimo: number;
  usos_max: number | null;
  ativo: boolean;
  exibir_home: boolean;
  validade: string | null;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function criarCupomAction(data: CupomFormData): Promise<ActionResult> {
  const sb = await createSupabaseServerClient();
  const codigo = data.codigo.toUpperCase().trim();
  if (!codigo) return { ok: false, error: "Código obrigatório" };

  const { error } = await sb.from("cupons").insert({
    ...data,
    codigo,
    validade: data.validade || null,
    usos_max: data.usos_max || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/cupons");
  return { ok: true };
}

export async function atualizarCupomAction(
  id: string,
  data: CupomFormData,
): Promise<ActionResult> {
  const sb = await createSupabaseServerClient();
  const codigo = data.codigo.toUpperCase().trim();
  if (!codigo) return { ok: false, error: "Código obrigatório" };

  const { error } = await sb
    .from("cupons")
    .update({ ...data, codigo, validade: data.validade || null, usos_max: data.usos_max || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/cupons");
  revalidatePath(`/admin/cupons/${id}`);
  return { ok: true };
}

export async function toggleCupomAction(id: string, ativo: boolean): Promise<ActionResult> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("cupons").update({ ativo }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/cupons");
  return { ok: true };
}

export async function deletarCupomAction(id: string): Promise<ActionResult> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("cupons").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/cupons");
  return { ok: true };
}
