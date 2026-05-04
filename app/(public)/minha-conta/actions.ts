"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Endereco } from "@/types";

export async function atualizarPerfilAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const nome = (formData.get("nome") as string)?.trim();
  const contato = (formData.get("contato") as string)?.replace(/\D/g, "");
  const cep = (formData.get("cep") as string)?.replace(/\D/g, "");
  const rua = (formData.get("rua") as string)?.trim();
  const numero = (formData.get("numero") as string)?.trim();
  const bairro = (formData.get("bairro") as string)?.trim();
  const cidade = (formData.get("cidade") as string)?.trim();
  const uf = (formData.get("uf") as string)?.trim().toUpperCase().slice(0, 2);
  const complemento = (formData.get("complemento") as string)?.trim() || undefined;

  if (!nome || nome.length < 2) return { ok: false, error: "Nome inválido." };
  if (!contato || contato.length < 10) return { ok: false, error: "Telefone inválido." };

  const endereco: Endereco | null =
    cep && rua && numero && bairro && cidade && uf
      ? { cep, rua, numero, bairro, cidade, uf, complemento }
      : null;

  const { error } = await sb
    .from("clientes")
    .update({ nome, contato, endereco })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Erro ao atualizar perfil." };

  revalidatePath("/minha-conta");
  return { ok: true };
}
