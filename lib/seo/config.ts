// Config do motor de linkagem interna (doc 03 §3.4 / §4). Tudo determinístico,
// custo zero. Estes valores são o ÚNICO ponto de ajuste do anti-spam: o algoritmo
// em internal-links.ts lê daqui, então tunar limites não exige tocar na lógica.

/**
 * Regras anti-spam / over-optimization (doc 03 §4).
 * - MAX_LINKS_TOTAL: teto absoluto de links in-content por artigo. O motor ainda
 *   escala pelo tamanho do texto: min(MAX_LINKS_TOTAL, floor(palavras / PALAVRAS_POR_LINK)).
 * - PALAVRAS_POR_LINK: densidade — no máximo ~1 link a cada N palavras.
 * - PROXIMIDADE_PALAVRAS: janela anti-cluster (não 2 links coladas).
 * - MIN_TERMO_LEN: descarta termos curtos demais (ruído).
 * - MAX_PRODUTOS_BLOCO / MAX_CATEGORIAS / MAX_MARCAS / MAX_LEIA_TAMBEM: tamanho
 *   dos blocos de "relacionados".
 */
export const LINK_RULES = {
  MAX_LINKS_TOTAL: 8,
  PALAVRAS_POR_LINK: 120,
  PROXIMIDADE_PALAVRAS: 10,
  MIN_TERMO_LEN: 4,
  MAX_PRODUTOS_BLOCO: 4,
  MAX_CATEGORIAS: 3,
  MAX_MARCAS: 2,
  MAX_LEIA_TAMBEM: 3,
} as const;

/**
 * Termos genéricos demais para virar âncora sozinhos (reduz ruído/ambiguidade).
 * Já NORMALIZADOS (normalizePt): minúsculas, sem acento. O dicionário filtra
 * qualquer entrada cujo `termo` caia neste set.
 */
export const STOPTERMS: ReadonlySet<string> = new Set([
  "kit",
  "ferramenta",
  "ferramentas",
  "equipamento",
  "equipamentos",
  "produto",
  "produtos",
  "obra",
  "qualidade",
  "marca",
  "profissional",
]);

/**
 * Peso base de prioridade por tipo de destino (doc 03 §3.4).
 * Produto específico é o mais valioso comercialmente (leva ao orçamento);
 * marca é genérica (muitas páginas competem). Usado no desempate determinístico:
 * n-grama maior > prioridade maior > match de nome > slug alfabético.
 */
export const PRIORIDADE_TIPO = {
  produto: 5,
  cluster: 4,
  categoria: 3,
  artigo: 2,
  marca: 1,
} as const;

export type LinkTargetType = keyof typeof PRIORIDADE_TIPO;
