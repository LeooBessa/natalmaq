/**
 * Parser do PDF "Tabela de Produtos" exportado pelo Delphi Sistemas.
 *
 * Estratégia híbrida:
 *  - Regex sobre o texto da linha para anchor estáveis: código (início),
 *    ICMS% (fim), preço (antes do %), referência (após %).
 *  - Posição X dos fragmentos para separar descrição (esquerda) de
 *    fabricante (centro, antes da coluna Loja).
 */

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
};

export type PdfProdutoRow = {
  codigo: string;
  descricao: string;
  fabricante: string | null;
  estoque: number | null;
  preco: number | null;
  referencia: string | null;
};

type ColumnX = { descricao: number; fabricante: number; loja: number };

function parseBrNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function groupLines(items: PdfTextItem[], yTolerance = 2) {
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of items) {
    const y = it.transform[5];
    const line = lines.find((l) => Math.abs(l.y - y) <= yTolerance);
    if (line) line.items.push(it);
    else lines.push({ y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.transform[4] - b.transform[4]);
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

function findHeaderColumns(
  lines: { y: number; items: PdfTextItem[] }[],
): ColumnX | null {
  for (const line of lines) {
    const xOf = (label: string): number | undefined => {
      const it = line.items.find((it) => it.str.trim().startsWith(label));
      return it?.transform[4];
    };
    const codigoX = xOf("Código");
    if (codigoX === undefined) continue;
    const descX = xOf("Descrição");
    const fabX = xOf("Fabricante");
    const lojaX = xOf("Loja");
    if (descX === undefined || fabX === undefined || lojaX === undefined) continue;
    return { descricao: descX, fabricante: fabX, loja: lojaX };
  }
  return null;
}

function joinSorted(items: PdfTextItem[]): string {
  let out = "";
  let prevEnd = -Infinity;
  for (const it of items) {
    const x = it.transform[4];
    if (out && x - prevEnd > 1.5) out += " ";
    out += it.str;
    prevEnd = x + (it.width ?? 0);
  }
  return out.replace(/\s+/g, " ").trim();
}

const LINE_RE =
  /^(\d{3,6})\s+(.+?)\s+([\d\.]+,\d{2})\s+(\d{1,2}\.\d{2})\s*%(?:\s+(\S.*?))?\s*$/;
const NUM_BR_RE = /([\d\.]+,\d+)/;

export async function extractProdutosFromPdf(
  buffer: Buffer,
): Promise<{ rows: PdfProdutoRow[]; warnings: string[] }> {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buffer));

  const warnings: string[] = [];
  const rows: PdfProdutoRow[] = [];
  let columns: ColumnX | null = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines = groupLines(content.items as PdfTextItem[]);

    if (!columns) {
      columns = findHeaderColumns(lines);
    }
    if (!columns) continue;

    for (const line of lines) {
      const fabZoneStart = columns.fabricante - 5;
      const fabZoneEnd = columns.loja - 10;

      const descricaoItems: PdfTextItem[] = [];
      const fabricanteItems: PdfTextItem[] = [];

      for (const it of line.items) {
        const x = it.transform[4];
        const txt = it.str.trim();
        if (!txt) continue;
        if (x < fabZoneStart) descricaoItems.push(it);
        else if (x < fabZoneEnd && !/^[\d\.]+,\d+$/.test(txt))
          fabricanteItems.push(it);
      }

      const fullLine = joinSorted(line.items);
      if (
        fullLine.includes("Código") &&
        fullLine.includes("Descrição") &&
        fullLine.includes("Fabricante")
      )
        continue;

      const m = fullLine.match(LINE_RE);
      if (!m) continue;
      const codigo = m[1];
      const middle = m[2];
      const preco = parseBrNumber(m[3]);
      const referencia = (m[5] ?? "").trim() || null;
      if (preco === null) continue;

      const numMatch = middle.match(NUM_BR_RE);
      const estoqueRaw = numMatch ? parseBrNumber(numMatch[1]) : null;
      const estoque =
        estoqueRaw !== null ? Math.max(0, Math.floor(estoqueRaw)) : null;

      const descricao = joinSorted(descricaoItems)
        .replace(new RegExp(`^${codigo}\\s+`), "")
        .trim();
      const fabricante = joinSorted(fabricanteItems).trim() || null;

      rows.push({ codigo, descricao, fabricante, estoque, preco, referencia });
    }
  }

  if (!columns) warnings.push("Cabeçalho 'Código Descrição Fabricante Loja' não encontrado.");
  if (rows.length === 0 && columns)
    warnings.push("Cabeçalho identificado, mas nenhuma linha de produto reconhecida.");

  return { rows, warnings };
}
