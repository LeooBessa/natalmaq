"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

function cep8(v: FormDataEntryValue | null): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

type Res = { ok?: true; error?: string };

// Atualiza a regra padrão (catch-all) — o frete de "demais regiões".
export async function saveDefaultFreteAction(
  id: string,
  valor: number,
  prazoDias: number,
): Promise<Res> {
  if (!id) return { error: "Regra padrão não encontrada." };
  if (!Number.isFinite(valor) || valor < 0) return { error: "Valor inválido." };
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("fretes_regra")
    .update({ valor, prazo_dias: Math.max(0, Math.round(prazoDias || 0)), por_kg: 0 })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/frete");
  return { ok: true };
}

// Cria/edita uma exceção por região (faixa de CEP).
export async function saveExcecaoFreteAction(formData: FormData): Promise<Res> {
  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const ini = cep8(formData.get("faixa_cep_inicio"));
  const fim = cep8(formData.get("faixa_cep_fim"));
  const valor = num(formData.get("valor"));
  const prazo = num(formData.get("prazo_dias"));

  if (!nome) return { error: "Dê um nome à região (ex.: Natal e região)." };
  if (!ini || !fim) return { error: "CEP inicial e final precisam ter 8 dígitos." };
  if (ini > fim) return { error: "O CEP inicial deve ser menor que o final." };
  if (valor === null || valor < 0) return { error: "Valor inválido." };

  const dados = {
    nome,
    faixa_cep_inicio: ini,
    faixa_cep_fim: fim,
    valor,
    prazo_dias: Math.max(0, Math.round(prazo ?? 0)),
    por_kg: 0,
    ordem: 50, // abaixo da catch-all (999) => exceções vencem o padrão
    uf: null,
  };

  const sb = await createSupabaseServerClient();
  const { error } = id
    ? await sb.from("fretes_regra").update(dados).eq("id", id)
    : await sb.from("fretes_regra").insert(dados);
  if (error) return { error: error.message };
  revalidatePath("/admin/frete");
  return { ok: true };
}

export async function deleteExcecaoFreteAction(id: string): Promise<Res> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.from("fretes_regra").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/frete");
  return { ok: true };
}
