import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { buildOrderMessage, buildWaLink } from "@/lib/whatsapp";
import { StatusBadge } from "../../dashboard/page";
import { PedidoActions } from "./PedidoActions";
import { PedidoEditor } from "./PedidoEditor";

export const dynamic = "force-dynamic";

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX (à vista)",
  dinheiro: "Dinheiro (à vista)",
  cartao_debito: "Cartão de débito",
  cartao_credito_1x: "Cartão de crédito à vista",
  cartao_credito_3x: "Cartão de crédito 3×",
  cartao_credito_6x: "Cartão de crédito 6×",
  cartao_credito_12x: "Cartão de crédito 12×",
  boleto_30: "Boleto 30 dias",
  boleto_30_60: "Boleto 30/60 dias",
  boleto_30_60_90: "Boleto 30/60/90 dias",
  faturado_28: "Faturado 28 dias",
};

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
      "id, numero, status, cliente_nome, cliente_telefone, cliente_email, endereco, subtotal, desconto, frete_valor, total, observacoes, whatsapp_url, forma_pagamento, criado_em, atualizado_em",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pedido) notFound();

  const { data: itens } = await sb
    .from("pedido_itens")
    .select("id, codigo, nome_snapshot, quantidade, preco_unit, preco_total, disponivel, desconto_perc")
    .eq("pedido_id", id);

  const itensNorm = (itens ?? []).map((i) => ({
    ...i,
    disponivel: i.disponivel ?? true,
    desconto_perc: Number(i.desconto_perc ?? 0),
    preco_total: Number(i.preco_total),
    preco_unit: Number(i.preco_unit),
  }));

  const mensagemCliente = buildOrderMessage({
    numero: pedido.numero,
    cliente_nome: pedido.cliente_nome,
    cliente_telefone: pedido.cliente_telefone,
    endereco: pedido.endereco ?? undefined,
    itens: itensNorm
      .filter((i) => i.disponivel)
      .map((i) => ({
        produto_id: "",
        codigo: i.codigo,
        slug: "",
        nome: i.nome_snapshot,
        imagem: null,
        preco_unit: i.preco_unit,
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
              {itensNorm.map((i) => (
                <tr
                  key={i.id}
                  className={`border-t border-zinc-100 ${!i.disponivel ? "bg-red-50" : ""}`}
                >
                  <td className="px-5 py-2 font-mono text-xs text-zinc-500">{i.codigo}</td>
                  <td className="px-5 py-2">
                    <span className={!i.disponivel ? "line-through text-zinc-400" : ""}>
                      {i.nome_snapshot}
                    </span>
                    {!i.disponivel && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                        sem estoque
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right">{i.quantidade}</td>
                  <td className={`px-5 py-2 text-right ${!i.disponivel ? "text-zinc-400 line-through" : ""}`}>
                    {formatBRL(i.preco_unit)}
                  </td>
                  <td className={`px-5 py-2 text-right font-semibold ${!i.disponivel ? "text-zinc-400 line-through" : ""}`}>
                    {formatBRL(i.preco_total)}
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
              {pedido.forma_pagamento && (
                <Row
                  label="Pagamento"
                  value={FORMA_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}
                />
              )}
              <Row label="TOTAL" value={formatBRL(Number(pedido.total))} bold />
            </tfoot>
          </table>
        </section>

        {/* Coluna direita: Cliente + Endereço + Ações */}
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">Cliente</h2>
            <div className="space-y-1 text-sm">
              <Field label="Nome" value={pedido.cliente_nome} />
              <Field label="Telefone" value={pedido.cliente_telefone} />
              {pedido.cliente_email && (
                <Field label="E-mail" value={pedido.cliente_email} />
              )}
            </div>
          </div>

          {pedido.endereco && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 font-semibold">Endereço</h2>
              <p className="text-sm text-zinc-700">
                {pedido.endereco.rua}, {pedido.endereco.numero}
                {pedido.endereco.complemento
                  ? ` (${pedido.endereco.complemento})`
                  : ""}
                <br />
                {pedido.endereco.bairro} — {pedido.endereco.cidade}/
                {pedido.endereco.uf}
                <br />
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

        {/* Editor de pedido — largura total (col-span-2) */}
        <section className="lg:col-span-2">
          <PedidoEditor
            pedidoId={pedido.id}
            itens={itensNorm}
            descontoGeralInicial={Number(pedido.desconto ?? 0)}
            freteInicial={Number(pedido.frete_valor)}
            formaPagamentoInicial={pedido.forma_pagamento ?? null}
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
      <td
        colSpan={4}
        className={`px-5 py-2 text-right ${bold ? "font-bold" : "text-zinc-500"}`}
      >
        {label}
      </td>
      <td className={`px-5 py-2 text-right ${bold ? "font-bold" : ""}`}>
        {value}
      </td>
    </tr>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
