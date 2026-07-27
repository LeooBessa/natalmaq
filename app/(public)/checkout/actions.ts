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

// `valorElegivel` = subtotal SÓ dos itens sem promoção. O cupom não incide
// sobre itens em promoção (não empilha desconto): o desconto e o pedido mínimo
// são calculados sobre esse valor elegível.
export async function validarCupomAction(
  codigo: string,
  valorElegivel: number,
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

  // Nada elegível = carrinho só com itens em promoção (ou vazio).
  if (valorElegivel <= 0)
    return {
      ok: false,
      erro: "Cupom não vale para itens em promoção. Adicione um item sem promoção para usar o cupom.",
    };

  if (valorElegivel < cupom.valor_minimo)
    return {
      ok: false,
      erro: `Pedido mínimo de ${formatBRL(cupom.valor_minimo)} (fora itens em promoção) para este cupom`,
    };

  const desconto =
    cupom.tipo === "percentual"
      ? Math.round(((valorElegivel * cupom.valor) / 100) * 100) / 100
      : Math.min(cupom.valor, valorElegivel);

  return { ok: true, codigo: cupom.codigo, descricao: cupom.descricao, desconto };
}
