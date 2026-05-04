"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Status = "pendente" | "aprovado" | "enviado" | "recusado";

export async function updateStatusAction(
  pedidoId: string,
  novoStatus: Status,
  observacoes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("pedidos")
    .update({
      status: novoStatus,
      ...(observacoes !== undefined ? { observacoes } : {}),
    })
    .eq("id", pedidoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export async function editarPedidoAction(
  pedidoId: string,
  data: {
    desconto: number;
    frete_valor: number;
    forma_pagamento: string;
    itens: { id: string; disponivel: boolean; desconto_perc: number }[];
  },
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createSupabaseServerClient();

  // Atualiza disponibilidade e desconto de cada item
  for (const item of data.itens) {
    const { error } = await sb
      .from("pedido_itens")
      .update({ disponivel: item.disponivel, desconto_perc: item.desconto_perc })
      .eq("id", item.id);
    if (error) return { ok: false, error: error.message };
  }

  // Recalcula subtotal: itens disponíveis com desconto por item aplicado
  const { data: itens, error: itensErr } = await sb
    .from("pedido_itens")
    .select("preco_total, desconto_perc, disponivel")
    .eq("pedido_id", pedidoId);

  if (itensErr) return { ok: false, error: itensErr.message };

  const subtotal = (itens ?? [])
    .filter((i) => i.disponivel)
    .reduce(
      (sum, i) =>
        sum + Number(i.preco_total) * (1 - Number(i.desconto_perc ?? 0) / 100),
      0,
    );

  const total = Math.max(0, subtotal - data.desconto + data.frete_valor);

  const { error } = await sb
    .from("pedidos")
    .update({
      desconto: data.desconto,
      frete_valor: data.frete_valor,
      subtotal,
      total,
      forma_pagamento: data.forma_pagamento || null,
    })
    .eq("id", pedidoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
