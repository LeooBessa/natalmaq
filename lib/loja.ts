// Informacoes centrais da loja fisica. Usado em Footer, Checkout (modo
// retirada), pagina de pedido (admin + cliente) e mensagem WhatsApp.

export const LOJA_ENDERECO = {
  rua: "R. Pres. Sarmento, 545",
  bairro: "Alecrim",
  cidade: "Natal",
  uf: "RN",
  cep: "59037-400",
};

export const LOJA_HORARIO = "Seg-Sex 7h-18h · Sáb 7h-12h";

export function formatEnderecoLoja(): string {
  const e = LOJA_ENDERECO;
  return `${e.rua} — ${e.bairro}, ${e.cidade}/${e.uf} · CEP ${e.cep}`;
}
