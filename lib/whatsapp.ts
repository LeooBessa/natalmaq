import { formatBRL } from "./format";
import type { CartItem, Endereco } from "@/types";

export type OrderMessageInput = {
  numero?: number;             // número do pedido (após criação)
  cliente_nome: string;
  cliente_telefone: string;
  endereco?: Endereco;
  itens: CartItem[];
  subtotal: number;
  desconto?: number;
  frete_valor: number;
  total: number;
  observacoes?: string;
  link_acompanhamento?: string;
};

/**
 * Monta a mensagem de orçamento padronizada que será enviada via WhatsApp.
 * Mantém formato em texto puro (compatível com qualquer cliente WhatsApp).
 */
export function buildOrderMessage(input: OrderMessageInput): string {
  const lojaNome = process.env.NEXT_PUBLIC_LOJA_NOME ?? "Natalmaq";

  const lines: string[] = [];
  const header = input.numero
    ? `*ORÇAMENTO #${String(input.numero).padStart(5, "0")}* — ${lojaNome}`
    : `*NOVO ORÇAMENTO* — ${lojaNome}`;
  lines.push(header);
  lines.push("");

  lines.push(`*Cliente:* ${input.cliente_nome}`);
  lines.push(`*Telefone:* ${input.cliente_telefone}`);
  if (input.endereco) {
    const e = input.endereco;
    const linha1 = [e.rua, e.numero].filter(Boolean).join(", ");
    const linha2 = [e.bairro, `${e.cidade}/${e.uf}`, e.cep]
      .filter(Boolean)
      .join(" — ");
    lines.push(`*Endereço:* ${linha1}`);
    if (linha2) lines.push(`           ${linha2}`);
    if (e.complemento) lines.push(`*Compl.:* ${e.complemento}`);
  }
  lines.push("");

  lines.push("*ITENS:*");
  for (const i of input.itens) {
    const totalItem = i.preco_unit * i.quantidade;
    lines.push(
      `• ${i.quantidade}x ${i.nome} (${i.codigo}) — ${formatBRL(totalItem)}`,
    );
  }
  lines.push("");

  lines.push(`Subtotal: ${formatBRL(input.subtotal)}`);
  if (input.desconto && input.desconto > 0) {
    lines.push(`Desconto: -${formatBRL(input.desconto)}`);
  }
  lines.push(`Frete:    ${formatBRL(input.frete_valor)}`);
  lines.push(`*TOTAL:   ${formatBRL(input.total)}*`);

  if (input.observacoes) {
    lines.push("");
    lines.push(`_Observações:_ ${input.observacoes}`);
  }
  if (input.link_acompanhamento) {
    lines.push("");
    lines.push(`Acompanhamento: ${input.link_acompanhamento}`);
  }

  return lines.join("\n");
}

/**
 * Constrói o link `wa.me` (deeplink) com a mensagem encodada.
 * O número aceita formato com ou sem DDI; vai sanitizado.
 */
export function buildWaLink(numero: string, mensagem: string): string {
  const tel = numero.replace(/\D/g, "");
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Helper de uso comum: monta link para o número da loja a partir das envs.
 */
export function buildWaLinkLoja(mensagem: string): string {
  const numero = process.env.NEXT_PUBLIC_LOJA_WHATSAPP ?? "";
  return buildWaLink(numero, mensagem);
}
