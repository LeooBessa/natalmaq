// Normalização pt-BR — espelha `immutable_unaccent` do Postgres (doc 03 §3.1).
// Forma canônica para matching: deve concordar com o `unaccent` do banco para
// que JS e SQL produzam a mesma forma. Função pura, sem dependências.

/** Minúsculas, sem acento (NFD), pontuação -> espaço, espaços colapsados. */
export function normalizePt(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (= unaccent)
    .replace(/[^a-z0-9\s-]/g, " ") // pontuação -> espaço
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza em palavras (para limites de palavra). */
export function tokensPt(s: string): string[] {
  return normalizePt(s).split(" ").filter(Boolean);
}

/**
 * Mapa de offsets normalizado <-> raw (doc 03 §3.3).
 *
 * `normalizePt` colapsa acentos/pontuação/espaços, então o texto normalizado
 * tem comprimento diferente do raw e os offsets não batem. O motor casa termos
 * sobre `norm` (forma canônica) mas precisa devolver os offsets do texto RAW
 * para fatiar a âncora exata (preservando caixa/acento) sem cortar palavra.
 *
 * Estratégia: produz uma forma normalizada caractere-a-caractere que MANTÉM o
 * alinhamento posicional com o raw (mesma contagem de caracteres). Cada char raw
 * vira exatamente 1 char em `norm`:
 *   - letras/dígitos: minúscula sem acento;
 *   - qualquer outra coisa (pontuação, espaço, hífen): um único espaço.
 * Sequências de espaço NÃO são colapsadas aqui (colapsar quebraria o alinhamento
 * 1:1). O matcher de n-gramas trata múltiplos espaços tolerando-os entre palavras.
 *
 * `toRaw(normStart, normEnd)` é a identidade (1:1), mas é exposto como método para
 * manter a mesma interface do pseudo-código do doc e permitir trocar a estratégia
 * sem mexer no chamador.
 */
export interface NormIndexMap {
  /** Forma normalizada alinhada 1:1 (mesmo length) com o raw. */
  norm: string;
  /** Texto original, intocado. */
  raw: string;
  /** Converte offsets de `norm` para offsets de `raw` (1:1 nesta estratégia). */
  toRaw(normStart: number, normEnd: number): { start: number; end: number };
}

/** Diacríticos combinantes (mesma classe usada em normalizePt). */
const DIACRITICS = /[̀-ͯ]/g;

export function buildNormIndexMap(raw: string): NormIndexMap {
  let norm = "";
  for (const ch of raw) {
    const lowered = ch.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
    // `ch` é 1 code point; após NFD pode virar 1 base + combinantes (já removidos).
    // Pode também, em casos raros (ß -> ss), virar 2 chars; normalizamos para 1
    // char por code-point de entrada para preservar o alinhamento 1:1 com o raw
    // (que indexamos por UTF-16). Pegamos o 1º char util ou espaço.
    const base = lowered.length > 0 ? lowered[0] : " ";
    norm += /[a-z0-9]/.test(base) ? base : " ";
    // `ch` pode ocupar 2 unidades UTF-16 (surrogate pair); preenche o segundo
    // slot com espaço para manter offsets alinhados ao raw indexado por charAt.
    if (ch.length > 1) norm += " ".repeat(ch.length - 1);
  }
  return {
    norm,
    raw,
    toRaw(normStart: number, normEnd: number) {
      return { start: normStart, end: normEnd };
    },
  };
}
