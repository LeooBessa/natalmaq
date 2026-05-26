"use client";

import { useState, useTransition } from "react";
import { Check, Copy, MessageCircle, UserCheck, X } from "lucide-react";

import { updateStatusAction } from "../actions";
import type { PedidoStatus } from "../_lib/status";

type Props = {
  pedidoId: string;
  status: string;
  mensagemCliente: string;
  waClienteUrl: string;
  observacoes: string;
};

export function PedidoActions({
  pedidoId,
  status,
  mensagemCliente,
  waClienteUrl,
  observacoes: obsInicial,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [obs, setObs] = useState(obsInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function changeStatus(novo: PedidoStatus) {
    setErro(null);
    startTransition(async () => {
      const r = await updateStatusAction(pedidoId, novo, obs);
      if (!r.ok) setErro(r.error ?? "Falha ao atualizar.");
    });
  }

  async function copiarPedido() {
    try {
      await navigator.clipboard.writeText(mensagemCliente);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold">Ações</h2>

      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        rows={3}
        placeholder="Observação interna (opcional)"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pending || status === "aprovado"}
          onClick={() => changeStatus("aprovado")}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Aprovar
        </button>
        <button
          disabled={pending || status === "recusado"}
          onClick={() => changeStatus("recusado")}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Recusar
        </button>
        <button
          disabled={pending || status === "confirmado"}
          onClick={() => changeStatus("confirmado")}
          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
        >
          <UserCheck className="h-4 w-4" />
          Confirmado pelo cliente
        </button>
        <button
          disabled={pending || status === "enviado"}
          onClick={() => changeStatus("enviado")}
          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
        >
          Marcar como enviado
        </button>
      </div>

      <hr className="my-2" />

      <a
        href={waClienteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
      >
        <MessageCircle className="h-4 w-4" />
        Enviar para cliente via WhatsApp
      </a>
      <button
        onClick={copiarPedido}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
      >
        {copiado ? (
          <>
            <Check className="h-4 w-4" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copiar pedido em texto
          </>
        )}
      </button>

      {erro && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
