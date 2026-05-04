"use server";

import { createClient } from "@supabase/supabase-js";

import { formatBRL } from "@/lib/format";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type ValidarCupomResult =
  | { ok: true; codigo: string; descricao: string | null; desconto: number }
  | { ok: false; erro: string };

export async function validarCupomAction(
  codigo: string,
  valorPedido: number,
): Promise<ValidarCupomResult> {
  const sb = getAdminSupabase();
  const { data: cupom } = await sb
    .from("cupons")
    .select("codigo, descricao, tipo, valor, valor_minimo, usos_max, usos_atual, ativo, validade")
    .eq("codigo", codigo.toUpperCase().trim())
    .eq("ativo", true)
    .maybeSingle();

  if (!cupom) return { ok: false, erro: "Cupom inválido ou inexistente" };

  if (cupom.validade && new Date(cupom.validade) < new Date())
    return { ok: false, erro: "Cupom expirado" };

  if (cupom.usos_max !== null && cupom.usos_atual >= cupom.usos_max)
    return { ok: false, erro: "Cupom atingiu o limite de usos" };

  if (valorPedido < cupom.valor_minimo)
    return {
      ok: false,
      erro: `Pedido mínimo de ${formatBRL(cupom.valor_minimo)} para este cupom`,
    };

  const desconto =
    cupom.tipo === "percentual"
      ? Math.round(((valorPedido * cupom.valor) / 100) * 100) / 100
      : Math.min(cupom.valor, valorPedido);

  return { ok: true, codigo: cupom.codigo, descricao: cupom.descricao, desconto };
}
