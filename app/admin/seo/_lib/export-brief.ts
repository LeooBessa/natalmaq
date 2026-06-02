// "Exportar brief de redação" — doc 05 §9-opcional.
// Função PURA (sem IA no runtime, custo zero): monta um texto/markdown
// estruturado que o dono copia para o ChatGPT/Claude DELE, fora do sistema.
// Nada aqui chama rede.

export type ExportBriefInput = {
  cluster?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  titulo?: string;
  sugestoesProdutos?: string[];
};

export function exportBrief(input: ExportBriefInput): string {
  const cluster = (input.cluster ?? "").trim() || "—";
  const primary = (input.primaryKeyword ?? "").trim() || "—";
  const secundarias = (input.secondaryKeywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean);
  const secundariasStr = secundarias.length ? secundarias.join(", ") : "—";
  const titulo = (input.titulo ?? "").trim() || "(definir título)";
  const produtos = (input.sugestoesProdutos ?? [])
    .map((p) => p.trim())
    .filter(Boolean);
  const produtosStr = produtos.length ? produtos.join(", ") : "produtos/categorias relevantes do catálogo";

  return [
    "Escreva um artigo para o blog da Natalmaq (loja B2B de ferramentas em Natal/RN).",
    `Cluster: ${cluster} | Keyword primária: ${primary} | Secundárias: ${secundariasStr}`,
    `Título alvo: ${titulo}`,
    "Público: profissionais da construção/indústria, tom prático PT-BR, sem emojis.",
    "Estrutura desejada: 1 intro, 4–6 H2, listas onde fizer sentido, 3 FAQs.",
    `Inclua menções naturais a: ${produtosStr}.`,
    "Não invente preços. CTA final: orçamento via WhatsApp.",
    "Cole o texto de volta no editor de blocos.",
  ].join("\n");
}
