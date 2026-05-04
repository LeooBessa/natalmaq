"use client";

import { deletarCupomAction } from "./actions";

export function BotaoDeletar({ id }: { id: string }) {
  return (
    <button
      type="button"
      className="text-xs text-red-500 hover:underline"
      onClick={async () => {
        if (!confirm("Excluir este cupom?")) return;
        await deletarCupomAction(id);
      }}
    >
      Excluir
    </button>
  );
}
