/**
 * Heurísticas de auto-agrupamento e categorização para o importador de PDF.
 *
 * - extractCategoria: deriva categoria da primeira palavra da descrição.
 * - clusterVariantes: agrupa produtos do mesmo fabricante que compartilham
 *   prefixo de palavras (mesmo "produto-família" com tamanhos diferentes).
 */

export type ProdutoMin = {
  codigo: string;
  descricao: string;
  fabricante: string | null;
};

// ----------------------------------------------------------------------------
// Categoria
// ----------------------------------------------------------------------------

function unaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function slugify(t: string): string {
  return unaccent(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Lê a primeira palavra (com pontuação removida) como categoria. */
export function extractCategoria(
  descricao: string,
): { nome: string; slug: string } | null {
  const first = descricao.split(/\s+/)[0]?.replace(/[.,;:]+$/, "");
  if (!first || first.length < 2) return null;
  const nome = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const slug = slugify(first);
  if (!slug) return null;
  return { nome, slug };
}

// ----------------------------------------------------------------------------
// Variantes
// ----------------------------------------------------------------------------

/** Conta palavras em comum no início (case-insensitive). */
function commonWordPrefix(a: string, b: string): string[] {
  const wa = a.split(/\s+/);
  const wb = b.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < Math.min(wa.length, wb.length); i++) {
    if (wa[i].toLowerCase() === wb[i].toLowerCase()) out.push(wa[i]);
    else break;
  }
  return out;
}

export type Cluster = {
  fabricante: string;
  prefixo: string; // prefixo comum (palavras coladas)
  itens: ProdutoMin[];
};

/**
 * Agrupa produtos do mesmo fabricante que compartilham ≥2 palavras de prefixo
 * (com mínimo 10 chars). Retorna apenas clusters com 2+ itens.
 */
export function clusterVariantes(produtos: ProdutoMin[]): Cluster[] {
  // Agrupa por fabricante.
  const porFabricante = new Map<string, ProdutoMin[]>();
  for (const p of produtos) {
    if (!p.fabricante || !p.descricao || p.descricao.length < 5) continue;
    const f = p.fabricante.toLowerCase().trim();
    const arr = porFabricante.get(f);
    if (arr) arr.push(p);
    else porFabricante.set(f, [p]);
  }

  const clusters: Cluster[] = [];
  for (const [fabricante, arr] of porFabricante) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => a.descricao.localeCompare(b.descricao));

    let cur: { itens: ProdutoMin[]; prefixoPalavras: string[] } | null = null;

    for (const p of arr) {
      if (!cur) {
        cur = { itens: [p], prefixoPalavras: p.descricao.split(/\s+/) };
        continue;
      }
      const cand = commonWordPrefix(
        cur.prefixoPalavras.join(" "),
        p.descricao,
      );
      const candStr = cand.join(" ");
      if (cand.length >= 2 && candStr.length >= 10) {
        cur.itens.push(p);
        cur.prefixoPalavras = cand;
      } else {
        if (cur.itens.length >= 2) {
          clusters.push({
            fabricante,
            prefixo: cur.prefixoPalavras.join(" "),
            itens: cur.itens,
          });
        }
        cur = { itens: [p], prefixoPalavras: p.descricao.split(/\s+/) };
      }
    }
    if (cur && cur.itens.length >= 2) {
      clusters.push({
        fabricante,
        prefixo: cur.prefixoPalavras.join(" "),
        itens: cur.itens,
      });
    }
  }

  return clusters;
}

/** Extrai o "rótulo" da variante: descrição menos o prefixo comum. */
export function extractVarianteLabel(descricao: string, prefixo: string): string {
  const lower = descricao.toLowerCase();
  const prefLower = prefixo.toLowerCase();
  if (lower.startsWith(prefLower)) {
    return descricao.slice(prefixo.length).replace(/^[\s\-,:]+/, "").trim();
  }
  return descricao;
}
