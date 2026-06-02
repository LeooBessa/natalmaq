import {
  PEDIDO_STATUS_BADGE,
  PEDIDO_STATUS_LABEL_CURTO,
  isPedidoStatus,
} from "../_lib/status";

export function StatusBadge({ status }: { status: string }) {
  const cls = isPedidoStatus(status) ? PEDIDO_STATUS_BADGE[status] : "bg-zinc-100 text-zinc-700";
  const label = isPedidoStatus(status) ? PEDIDO_STATUS_LABEL_CURTO[status] : status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
