"use client";

import { useState, useTransition } from "react";
import { editarPedidoAction } from "../actions";

type Item = {
  id: string;
  codigo: string;
  nome_snapshot: string;
  quantidade: number;
  preco_unit: number;
  preco_total: number;
  disponivel: boolean;
  desconto_perc: number;
};

type Props = {
  pedidoId: string;
  itens: Item[];
  descontoGeralInicial: number;
  freteInicial: number;
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200";

export function PedidoEditor({
  pedidoId,
  itens,
  descontoGeralInicial,
  freteInicial,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [descontoGeral, setDescontoGeral] = useState(descontoGeralInicial.toFixed(2));
  const [frete, setFrete] = useState(freteInicial.toFixed(2));

  const [disponibilidade, setDisponibilidade] = useState<Record<string, boolean>>(
    Object.fromEntries(itens.map((i) => [i.id, i.disponivel])),
  );
  const [descontosItem, setDescontosItem] = useState<Record<string, string>>(
    Object.fromEntries(
      itens.map((i) => [i.id, i.desconto_perc > 0 ? String(i.desconto_perc) : ""]),
    ),
  );
  const [quantidades, setQuantidades] = useState<Record<string, string>>(
    Object.fromEntries(itens.map((i) => [i.id, String(i.quantidade)])),
  );

  const descontoGeralNum = parseFloat(descontoGeral) || 0;
  const freteNum = parseFloat(frete) || 0;

  function itemEfetivo(item: Item): number {
    const qtd = Math.max(1, parseInt(quantidades[item.id] || "1") || 1);
    const disc = parseFloat(descontosItem[item.id] || "0") || 0;
    return item.preco_unit * qtd * (1 - disc / 100);
  }

  const subtotalDisponivel = itens
    .filter((i) => disponibilidade[i.id])
    .reduce((sum, i) => sum + itemEfetivo(i), 0);

  const totalCalculado = Math.max(0, subtotalDisponivel - descontoGeralNum + freteNum);

  function toggleItem(id: string) {
    setDisponibilidade((prev) => ({ ...prev, [id]: !prev[id] }));
    setSalvo(false);
  }

  function setDiscItem(id: string, val: string) {
    setDescontosItem((prev) => ({ ...prev, [id]: val }));
    setSalvo(false);
  }

  function setQtdItem(id: string, val: string) {
    setQuantidades((prev) => ({ ...prev, [id]: val }));
    setSalvo(false);
  }

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await editarPedidoAction(pedidoId, {
        desconto: descontoGeralNum,
        frete_valor: freteNum,
        itens: itens.map((i) => ({
          id: i.id,
          disponivel: disponibilidade[i.id],
          desconto_perc: parseFloat(descontosItem[i.id] || "0") || 0,
          quantidade: Math.max(1, parseInt(quantidades[i.id] || "1") || 1),
          preco_unit: i.preco_unit,
        })),
      });
      if (r.ok) setSalvo(true);
      else setErro(r.error ?? "Erro ao salvar");
    });
  }

  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold text-zinc-900">Editar pedido</h2>

      {/* Desconto geral + Frete */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="desconto-geral" className="mb-1 block text-xs font-medium text-zinc-500">
            Desconto geral (R$)
          </label>
          <input
            id="desconto-geral"
            type="number"
            min="0"
            step="0.01"
            value={descontoGeral}
            onChange={(e) => { setDescontoGeral(e.target.value); setSalvo(false); }}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="frete" className="mb-1 block text-xs font-medium text-zinc-500">
            Frete (R$)
          </label>
          <input
            id="frete"
            type="number"
            min="0"
            step="0.01"
            value={frete}
            onChange={(e) => { setFrete(e.target.value); setSalvo(false); }}
            className={inputCls}
          />
        </div>
      </div>

      {/* Itens: quantidade + desconto + disponibilidade */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500">
          Quantidade, desconto por produto e disponibilidade
        </p>
        <div className="divide-y divide-zinc-100 rounded border border-zinc-200">
          {itens.map((item) => {
            const disp = disponibilidade[item.id];
            const discStr = descontosItem[item.id] || "";
            const discPerc = parseFloat(discStr) || 0;
            const qtd = Math.max(1, parseInt(quantidades[item.id] || "1") || 1);
            const precoTotal = item.preco_unit * qtd;
            const efetivo = precoTotal * (1 - discPerc / 100);
            const temDesconto = discPerc > 0;

            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${!disp ? "bg-red-50" : ""}`}
              >
                {/* Info do item */}
                <div className={`min-w-0 flex-1 text-sm ${!disp ? "text-zinc-400" : "text-zinc-800"}`}>
                  <span className="mr-1 font-mono text-xs text-zinc-400">{item.codigo}</span>
                  <span className={!disp ? "line-through" : ""}>{item.nome_snapshot}</span>
                  <div className="text-[11px] text-zinc-400">
                    {fmt(item.preco_unit)} cada
                  </div>
                </div>

                {/* Input de quantidade */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQtdItem(item.id, String(Math.max(1, qtd - 1)))}
                    disabled={qtd <= 1}
                    aria-label="Diminuir quantidade"
                    className="rounded border border-zinc-300 px-2 py-0.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantidades[item.id] || ""}
                    onChange={(e) => setQtdItem(item.id, e.target.value)}
                    aria-label={`Quantidade de ${item.nome_snapshot}`}
                    className="w-12 rounded border border-zinc-300 px-1 py-1 text-center text-xs outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQtdItem(item.id, String(qtd + 1))}
                    aria-label="Aumentar quantidade"
                    className="rounded border border-zinc-300 px-2 py-0.5 text-zinc-600 hover:bg-zinc-50"
                  >
                    +
                  </button>
                </div>

                {/* Input de desconto % */}
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={discStr}
                    onChange={(e) => setDiscItem(item.id, e.target.value)}
                    placeholder="0"
                    aria-label={`Desconto % em ${item.nome_snapshot}`}
                    className="w-14 rounded border border-zinc-300 px-2 py-1 text-center text-xs outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-zinc-400">%</span>
                </div>

                {/* Preço */}
                <div className="shrink-0 text-right">
                  {temDesconto ? (
                    <>
                      <div className="text-[11px] leading-none text-zinc-400 line-through">
                        {fmt(precoTotal)}
                      </div>
                      <div className="text-sm font-semibold text-brand-600">
                        {fmt(efetivo)}
                      </div>
                    </>
                  ) : (
                    <div className={`text-sm font-semibold ${!disp ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                      {fmt(precoTotal)}
                    </div>
                  )}
                </div>

                {/* Toggle disponível */}
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
          <span>Subtotal (c/ descontos por item)</span>
          <span>{fmt(subtotalDisponivel)}</span>
        </div>
        {descontoGeralNum > 0 && (
          <div className="flex justify-between text-zinc-500">
            <span>Desconto geral</span>
            <span className="text-red-600">−{fmt(descontoGeralNum)}</span>
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
