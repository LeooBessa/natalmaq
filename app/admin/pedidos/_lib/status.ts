// Tipos e labels centralizados pros status de pedido.
// Ordem do enum no banco (migration 0014): pendente, aprovado, confirmado, enviado, recusado.

export const PEDIDO_STATUS = [
  "pendente",
  "aprovado",
  "confirmado",
  "enviado",
  "recusado",
] as const;

export type PedidoStatus = (typeof PEDIDO_STATUS)[number];

export const PEDIDO_STATUS_LABEL: Record<PedidoStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado pelo vendedor",
  confirmado: "Confirmado pelo cliente",
  enviado: "Enviado",
  recusado: "Recusado",
};

// Versao curta pra UI compacta (badges, dropdowns)
export const PEDIDO_STATUS_LABEL_CURTO: Record<PedidoStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  confirmado: "Confirmado",
  enviado: "Enviado",
  recusado: "Recusado",
};

export const PEDIDO_STATUS_BADGE: Record<PedidoStatus, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-blue-100 text-blue-800",
  confirmado: "bg-purple-100 text-purple-800",
  enviado: "bg-green-100 text-green-800",
  recusado: "bg-red-100 text-red-700",
};

export const PEDIDO_STATUS_KANBAN: Record<PedidoStatus, string> = {
  pendente: "bg-yellow-50 border-yellow-200",
  aprovado: "bg-blue-50 border-blue-200",
  confirmado: "bg-purple-50 border-purple-200",
  enviado: "bg-green-50 border-green-200",
  recusado: "bg-red-50 border-red-200",
};

export const PEDIDO_STATUS_BORDER: Record<PedidoStatus, string> = {
  pendente: "border-yellow-400",
  aprovado: "border-blue-400",
  confirmado: "border-purple-400",
  enviado: "border-green-400",
  recusado: "border-red-400",
};

export const PEDIDO_STATUS_TEXT: Record<PedidoStatus, string> = {
  pendente: "text-yellow-700",
  aprovado: "text-blue-700",
  confirmado: "text-purple-700",
  enviado: "text-green-700",
  recusado: "text-red-700",
};

export function isPedidoStatus(s: unknown): s is PedidoStatus {
  return typeof s === "string" && (PEDIDO_STATUS as readonly string[]).includes(s);
}
