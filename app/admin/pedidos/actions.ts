"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PedidoStatus } from "./_lib/status";

export async function updateStatusAction(
  pedidoId: string,
  novoStatus: PedidoStatus,
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
  revalidatePath("/minha-conta");
  revalidatePath(`/minha-conta/pedido/${pedidoId}`);
  return { ok: true };
}

export async function editarPedidoAction(
  pedidoId: string,
  data: {
    desconto: number;
    frete_valor: number;
    prazo_entrega_data: string | null;
    prazo_entrega_obs: string | null;
    itens: {
      id: string;
      disponivel: boolean;
      desconto_perc: number;
      quantidade: number;
      preco_unit: number;
    }[];
  },
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createSupabaseServerClient();

  // Atualiza quantidade, disponibilidade, desconto e preco_total de cada item.
  // preco_total = quantidade * preco_unit (preco_unit nao muda; e snapshot do preco vigente).
  for (const item of data.itens) {
    const qtd = Math.max(1, Math.floor(item.quantidade));
    const precoTotal = item.preco_unit * qtd;
    const { error } = await sb
      .from("pedido_itens")
      .update({
        quantidade: qtd,
        preco_total: precoTotal,
        disponivel: item.disponivel,
        desconto_perc: item.desconto_perc,
      })
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
      prazo_entrega_data: data.prazo_entrega_data,
      prazo_entrega_obs: data.prazo_entrega_obs,
    })
    .eq("id", pedidoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/minha-conta");
  revalidatePath(`/minha-conta/pedido/${pedidoId}`);
  return { ok: true };
}
