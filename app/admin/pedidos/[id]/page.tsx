import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { buildOrderMessage, buildWaLink } from "@/lib/whatsapp";
import { StatusBadge } from "../../dashboard/page";
import { PedidoActions } from "./PedidoActions";

export const dynamic = "force-dynamic";

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();

  const { data: pedido } = await sb
    .from("pedidos")
    .select(
      "id, numero, status, cliente_nome, cliente_telefone, cliente_email, endereco, subtotal, desconto, frete_valor, total, observacoes, whatsapp_url, criado_em, atualizado_em",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pedido) notFound();

  const { data: itens } = await sb
    .from("pedido_itens")
    .select("id, codigo, nome_snapshot, quantidade, preco_unit, preco_total")
    .eq("pedido_id", id);

  // Mensagem para enviar AO CLIENTE (pedido aprovado / confirmação)
  const mensagemCliente = buildOrderMessage({
    numero: pedido.numero,
    cliente_nome: pedido.cliente_nome,
    cliente_telefone: pedido.cliente_telefone,
    endereco: pedido.endereco ?? undefined,
    itens: (itens ?? []).map((i) => ({
      produto_id: "",
      codigo: i.codigo,
      slug: "",
      nome: i.nome_snapshot,
      imagem: null,
      preco_unit: Number(i.preco_unit),
      quantidade: i.quantidade,
      estoque: 0,
      peso_kg: 0,
    })),
    subtotal: Number(pedido.subtotal),
    desconto: Number(pedido.desconto ?? 0),
    frete_valor: Number(pedido.frete_valor),
    total: Number(pedido.total),
    observacoes: pedido.observacoes ?? undefined,
  });

  const waClienteUrl = buildWaLink(pedido.cliente_telefone, mensagemCliente);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/pedidos"
          className="text-sm text-brand-600 hover:underline"
        >
          ← Pedidos
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Pedido #{String(pedido.numero).padStart(5, "0")}
          </h1>
          <p className="text-sm text-zinc-500">
            Criado em {new Date(pedido.criado_em).toLocaleString("pt-BR")}
          </p>
        </div>
        <StatusBadge status={pedido.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Itens + totais */}
        <section className="rounded-lg border border-zinc-200 bg-white lg:col-span-2">
          <h2 className="border-b border-zinc-200 px-5 py-3 font-semibold">Itens</h2>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-2">Código</th>
                <th className="px-5 py-2">Produto</th>
                <th className="px-5 py-2 text-right">Qtde</th>
                <th className="px-5 py-2 text-right">Unit.</th>
                <th className="px-5 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(itens ?? []).map((i) => (
                <tr key={i.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 font-mono text-xs text-zinc-500">{i.codigo}</td>
                  <td className="px-5 py-2">{i.nome_snapshot}</td>
                  <td className="px-5 py-2 text-right">{i.quantidade}</td>
                  <td className="px-5 py-2 text-right">{formatBRL(Number(i.preco_unit))}</td>
                  <td className="px-5 py-2 text-right font-semibold">
                    {formatBRL(Number(i.preco_total))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-200 text-sm">
              <Row label="Subtotal" value={formatBRL(Number(pedido.subtotal))} />
              {Number(pedido.desconto) > 0 && (
                <Row label="Desconto" value={`-${formatBRL(Number(pedido.desconto))}`} />
              )}
              <Row label="Frete" value={formatBRL(Number(pedido.frete_valor))} />
              <Row label="TOTAL" value={formatBRL(Number(pedido.total))} bold />
            </tfoot>
          </table>
        </section>

        {/* Cliente + ações */}
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">Cliente</h2>
            <dl className="space-y-1 text-sm">
              <Field label="Nome" value={pedido.cliente_nome} />
              <Field label="Telefone" value={pedido.cliente_telefone} />
              {pedido.cliente_email && (
                <Field label="E-mail" value={pedido.cliente_email} />
              )}
            </dl>
          </div>

          {pedido.endereco && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 font-semibold">Endereço</h2>
              <p className="text-sm text-zinc-700">
                {pedido.endereco.rua}, {pedido.endereco.numero}
                {pedido.endereco.complemento ? ` (${pedido.endereco.complemento})` : ""}<br />
                {pedido.endereco.bairro} — {pedido.endereco.cidade}/{pedido.endereco.uf}<br />
                CEP {pedido.endereco.cep}
              </p>
            </div>
          )}

          <PedidoActions
            pedidoId={pedido.id}
            status={pedido.status}
            mensagemCliente={mensagemCliente}
            waClienteUrl={waClienteUrl}
            observacoes={pedido.observacoes ?? ""}
          />
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "bg-zinc-50" : ""}>
      <td colSpan={4} className={`px-5 py-2 text-right ${bold ? "font-bold" : ""}`}>
        {label}
      </td>
      <td className={`px-5 py-2 text-right ${bold ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
