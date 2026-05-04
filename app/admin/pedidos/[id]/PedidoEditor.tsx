"use client";

import { useState, useTransition } from "react";
import { editarPedidoAction } from "../actions";

type Item = {
  id: string;
  codigo: string;
  nome_snapshot: string;
  quantidade: number;
  preco_total: number;
  disponivel: boolean;
};

type Props = {
  pedidoId: string;
  itens: Item[];
  descontoInicial: number;
  freteInicial: number;
  formaPagamentoInicial: string | null;
};

const FORMAS_PAGAMENTO = [
  { value: "", label: "Não informado" },
  { value: "pix", label: "PIX (à vista)" },
  { value: "dinheiro", label: "Dinheiro (à vista)" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito_1x", label: "Cartão de crédito à vista" },
  { value: "cartao_credito_3x", label: "Cartão de crédito 3×" },
  { value: "cartao_credito_6x", label: "Cartão de crédito 6×" },
  { value: "cartao_credito_12x", label: "Cartão de crédito 12×" },
  { value: "boleto_30", label: "Boleto 30 dias" },
  { value: "boleto_30_60", label: "Boleto 30/60 dias" },
  { value: "boleto_30_60_90", label: "Boleto 30/60/90 dias" },
  { value: "faturado_28", label: "Faturado 28 dias" },
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PedidoEditor({
  pedidoId,
  itens,
  descontoInicial,
  freteInicial,
  formaPagamentoInicial,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [desconto, setDesconto] = useState(descontoInicial.toFixed(2));
  const [frete, setFrete] = useState(freteInicial.toFixed(2));
  const [formaPagamento, setFormaPagamento] = useState(
    formaPagamentoInicial ?? "",
  );
  const [disponibilidade, setDisponibilidade] = useState<
    Record<string, boolean>
  >(Object.fromEntries(itens.map((i) => [i.id, i.disponivel])));

  const descontoNum = parseFloat(desconto) || 0;
  const freteNum = parseFloat(frete) || 0;

  const subtotalDisponivel = itens
    .filter((i) => disponibilidade[i.id])
    .reduce((sum, i) => sum + i.preco_total, 0);

  const totalCalculado = Math.max(0, subtotalDisponivel - descontoNum + freteNum);

  function toggleItem(id: string) {
    setDisponibilidade((prev) => ({ ...prev, [id]: !prev[id] }));
    setSalvo(false);
  }

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await editarPedidoAction(pedidoId, {
        desconto: descontoNum,
        frete_valor: freteNum,
        forma_pagamento: formaPagamento,
        itens: itens.map((i) => ({ id: i.id, disponivel: disponibilidade[i.id] })),
      });
      if (r.ok) setSalvo(true);
      else setErro(r.error ?? "Erro ao salvar");
    });
  }

  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold text-zinc-900">Editar pedido</h2>

      {/* Ajustes financeiros */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Desconto adicional (R$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={desconto}
            onChange={(e) => {
              setDesconto(e.target.value);
              setSalvo(false);
            }}
            className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Frete (R$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={frete}
            onChange={(e) => {
              setFrete(e.target.value);
              setSalvo(false);
            }}
            className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Forma de pagamento
        </label>
        <select
          value={formaPagamento}
          onChange={(e) => {
            setFormaPagamento(e.target.value);
            setSalvo(false);
          }}
          className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
        >
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Disponibilidade dos itens */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500">
          Disponibilidade dos itens
        </p>
        <div className="divide-y divide-zinc-100 rounded border border-zinc-200">
          {itens.map((item) => {
            const disp = disponibilidade[item.id];
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm ${!disp ? "bg-red-50" : ""}`}
              >
                <div className={`min-w-0 flex-1 ${!disp ? "text-zinc-400" : "text-zinc-800"}`}>
                  <span className="mr-1.5 font-mono text-xs text-zinc-400">
                    {item.codigo}
                  </span>
                  <span className={!disp ? "line-through" : ""}>{item.nome_snapshot}</span>
                  <span className="ml-1.5 text-xs text-zinc-400">×{item.quantidade}</span>
                </div>
                <span
                  className={`text-xs font-semibold ${!disp ? "text-zinc-400 line-through" : "text-zinc-700"}`}
                >
                  {fmt(item.preco_total)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold transition ${
                    disp
                      ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                      : "bg-red-100 text-red-600 hover:bg-green-100 hover:text-green-700"
                  }`}
                >
                  {disp ? "Disponível" : "Sem estoque"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview do total */}
      <div className="space-y-1 rounded bg-zinc-50 p-3 text-sm">
        <div className="flex justify-between text-zinc-500">
          <span>Subtotal (itens disponíveis)</span>
          <span>{fmt(subtotalDisponivel)}</span>
        </div>
        {descontoNum > 0 && (
          <div className="flex justify-between text-zinc-500">
            <span>Desconto</span>
            <span className="text-red-600">−{fmt(descontoNum)}</span>
          </div>
        )}
        <div className="flex justify-between text-zinc-500">
          <span>Frete</span>
          <span>{fmt(freteNum)}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-bold text-zinc-900">
          <span>Total calculado</span>
          <span>{fmt(totalCalculado)}</span>
        </div>
      </div>

      {salvo && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Pedido atualizado com sucesso!
        </p>
      )}
      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={pending}
        className="w-full rounded bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Salvar ajustes"}
      </button>
    </div>
  );
}
