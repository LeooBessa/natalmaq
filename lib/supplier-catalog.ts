import "server-only";

import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { extractImages, getDocumentProxy } from "unpdf";

/**
 * Extrator de catálogo de fornecedor (PDF) — usa `unpdf` (versão
 * serverless-friendly do pdfjs, ~2MB vs 37MB) para evitar estourar
 * o limite de 250MB de função na Vercel.
 *
 * Devolve produtos detectados (tipo, modelo, tagline, bullets) +
 * imagens classificadas (produto/lifestyle/máscara/decorativo) prontas
 * pra subir no Storage.
 */

// ─── Tipos ────────────────────────────────────────────────────
export type ImagemTipo =
  | "produto"
  | "lifestyle"
  | "mascara"
  | "decorativo"
  | "outro";

export type ImagemExtraida = {
  hash: string;
  png: Buffer;
  w: number;
  h: number;
  tipo: ImagemTipo;
  score: number;
  aspect: number;
  white_corners: number;
  color: number;
  saturation: number;
};

export type ProdutoExtraido = {
  page: number;
  tipo: string;
  modelo: string;
  modelo_variante: string | null;
  codigos_pedido: string[];
  tagline: string;
  bullets: string[];
  descricao: string;
  imagens_candidatas_hashes: string[];
};

export type CatalogoExtraido = {
  total_paginas: number;
  produtos: ProdutoExtraido[];
  imagens: Map<string, ImagemExtraida>;
};

// ─── Padrões ──────────────────────────────────────────────────
const TIPO_RE =
  /^(PARAFUSADEIRA|FURADEIRA|MARTELETE|ESMERILHADEIRA|SERRA|TUPIA|LIXADEIRA|PLAINA|CHAVE\s+DE\s+IMPACTO|PARAFUSADEIRA[/]FURADEIRA|MARTELO|FRESADORA|GRAMPEADOR|SOPRADOR|ASPIRADOR|HIDROLAVADORA|MULTIPROCESSADORA|JATEADORA|ROUTER|JIG\s*SAW|ROMPEDOR|MULTI[- ]?CORTADORA|TICO[- ]?TICO|RETIFICADEIRA|PISTOLA|COMPRESSOR)/i;
const BULLET_RE = /^[fl•▪-]\s+(.+)/;

type PdfTextItem = { str: string; transform: number[] };

// ─── Função principal ────────────────────────────────────────
export async function extractSupplierCatalog(
  buffer: Buffer,
  opts?: { onProgress?: (page: number, total: number) => void },
): Promise<CatalogoExtraido> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);

  const imageRegistry = new Map<string, ImagemExtraida>();
  const pageImagensProduto = new Map<number, string[]>();
  const pageProdutos = new Map<number, ProdutoExtraido[]>();

  for (let p = 1; p <= pdf.numPages; p++) {
    opts?.onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const text = await page.getTextContent();

    // Texto → produtos
    const linhas = textPorLinha(text.items as PdfTextItem[]);
    const produtos = extractProdutosFromLinhas(linhas).map((prod) => ({
      ...prod,
      page: p,
      imagens_candidatas_hashes: [] as string[],
    }));
    pageProdutos.set(p, produtos);

    // Imagens via unpdf (mais simples — devolve já decoded com channels)
    let images: Awaited<ReturnType<typeof extractImages>> = [];
    try {
      images = await extractImages(pdf, p);
    } catch {
      images = [];
    }

    const imagensProduto: string[] = [];
    for (const img of images) {
      if (!img.width || !img.height || !img.data) continue;
      if (img.width < 80 || img.height < 80) continue;

      const rgba = toRGBAFromUnpdf(img);
      if (!rgba) continue;
      const hash = sha1(rgba);

      if (imageRegistry.has(hash)) {
        if (imageRegistry.get(hash)!.tipo === "produto") imagensProduto.push(hash);
        continue;
      }

      const score = scoreImage(rgba, img.width, img.height);
      const tipo = classifyImage(score, img.width, img.height);
      const png = encodePng(rgba, img.width, img.height);

      imageRegistry.set(hash, {
        hash,
        png,
        w: img.width,
        h: img.height,
        tipo,
        score: round3(score.total),
        aspect: round3(img.width / img.height),
        white_corners: round3(score.white_corners),
        color: round3(score.color),
        saturation: round3(score.saturation),
      });
      if (tipo === "produto") imagensProduto.push(hash);
    }

    pageImagensProduto.set(p, imagensProduto);
  }

  // Janela de páginas adjacentes p/ produtos sem foto
  const allProdutos: ProdutoExtraido[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const produtos = pageProdutos.get(p) ?? [];
    if (produtos.length === 0) continue;

    const imgs = pageImagensProduto.get(p) ?? [];
    const vizinhos: string[] = [];
    for (const offset of [-1, 1]) {
      const pn = p + offset;
      const vizProds = pageProdutos.get(pn) ?? [];
      if (vizProds.length === 0) {
        vizinhos.push(...(pageImagensProduto.get(pn) ?? []));
      }
    }
    const candidatas = dedupArray([...imgs, ...vizinhos]);
    for (const prod of produtos) {
      prod.imagens_candidatas_hashes = candidatas;
      allProdutos.push(prod);
    }
  }

  return {
    total_paginas: pdf.numPages,
    produtos: allProdutos,
    imagens: imageRegistry,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function dedupArray<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/** Converte ExtractedImageObject (unpdf) → RGBA Buffer. */
function toRGBAFromUnpdf(img: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: 1 | 3 | 4;
}): Buffer | null {
  const { width, height, channels, data } = img;
  const px = width * height;
  if (channels === 4 && data.length >= px * 4) {
    return Buffer.from(data.subarray(0, px * 4));
  }
  if (channels === 3 && data.length >= px * 3) {
    const out = Buffer.alloc(px * 4);
    for (let i = 0, j = 0; i < px * 3; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
    return out;
  }
  if (channels === 1 && data.length >= px) {
    const out = Buffer.alloc(px * 4);
    for (let i = 0, j = 0; i < px; i++, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i];
      out[j + 2] = data[i];
      out[j + 3] = 255;
    }
    return out;
  }
  return null;
}

function encodePng(rgba: Buffer, w: number, h: number): Buffer {
  const png = new PNG({ width: w, height: h });
  png.data = rgba;
  return PNG.sync.write(png);
}

function sha1(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex").slice(0, 16);
}

function scoreImage(rgba: Buffer, w: number, h: number) {
  const ar = w / h;
  const aspect =
    ar >= 0.5 && ar <= 2.0
      ? 1 - Math.abs(1 - ar) * 0.4
      : Math.max(0, 0.5 - Math.abs(1 - ar) * 0.3);

  const cornerSize = 8;
  const corners: [number, number][] = [
    [0, 0],
    [w - cornerSize, 0],
    [0, h - cornerSize],
    [w - cornerSize, h - cornerSize],
  ];
  let cleanCorners = 0;
  for (const [cx, cy] of corners) {
    const lums: number[] = [];
    for (let dy = 0; dy < cornerSize; dy++) {
      for (let dx = 0; dx < cornerSize; dx++) {
        const px = Math.max(0, Math.min(w - 1, cx + dx));
        const py = Math.max(0, Math.min(h - 1, cy + dy));
        const i = (py * w + px) * 4;
        const a = rgba[i + 3];
        if (a < 30) {
          lums.push(0);
          continue;
        }
        lums.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
      }
    }
    if (variance(lums) < 200) cleanCorners++;
  }
  const white_corners = cleanCorners / 4;

  const N = 16;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const lums: number[] = [];
  const sats: number[] = [];
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const sx = Math.floor((gx + 0.5) * (w / N));
      const sy = Math.floor((gy + 0.5) * (h / N));
      const i = (sy * w + sx) * 4;
      const r = rgba[i],
        g = rgba[i + 1],
        b = rgba[i + 2];
      rs.push(r);
      gs.push(g);
      bs.push(b);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      lums.push(0.299 * r + 0.587 * g + 0.114 * b);
      sats.push(max === 0 ? 0 : (max - min) / max);
    }
  }
  const lumVarNorm = Math.min(variance(lums) / 5000, 1);
  const colorNorm = Math.min(
    (variance(rs) + variance(gs) + variance(bs)) / 3 / 4000,
    1,
  );
  const sat = sats.reduce((a, b) => a + b, 0) / sats.length;

  return {
    total: aspect * 0.15 + white_corners * 0.4 + colorNorm * 0.3 + lumVarNorm * 0.15,
    aspect,
    white_corners,
    color: colorNorm,
    lum_var: lumVarNorm,
    saturation: sat,
  };
}

function variance(arr: number[]): number {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

function classifyImage(
  s: ReturnType<typeof scoreImage>,
  w: number,
  h: number,
): ImagemTipo {
  const ar = w / h;
  const isWideBanner = ar > 1.6 || ar < 0.55;

  if (s.saturation < 0.05 && s.lum_var > 0.2) return "mascara";
  if (s.color < 0.05 && s.lum_var < 0.1) return "decorativo";
  if (s.color > 0.7 && Math.min(w, h) >= 130) return "lifestyle";
  if (isWideBanner && s.color > 0.3 && Math.min(w, h) >= 130) return "lifestyle";
  if (
    !isWideBanner &&
    s.white_corners >= 0.5 &&
    s.saturation > 0.15 &&
    s.color > 0.1 &&
    s.color < 0.7
  )
    return "produto";
  if (
    !isWideBanner &&
    s.white_corners >= 0.75 &&
    s.color > 0.1 &&
    Math.min(w, h) >= 60
  )
    return "produto";
  return "outro";
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ─── Texto ──────────────────────────────────────────────────
function textPorLinha(items: PdfTextItem[]) {
  const linhas: { y: number; items: { x: number; str: string }[] }[] = [];
  for (const it of items) {
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    let linha = linhas.find((l) => Math.abs(l.y - y) <= 2);
    if (!linha) {
      linha = { y, items: [] };
      linhas.push(linha);
    }
    linha.items.push({ x, str: it.str });
  }
  for (const l of linhas) l.items.sort((a, b) => a.x - b.x);
  linhas.sort((a, b) => b.y - a.y);
  return linhas.map((l) => ({
    y: l.y,
    text: l.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim(),
  }));
}

function isContinuacaoProsa(text: string): boolean {
  if (text.length < 4 || text.length > 250) return false;
  if (TIPO_RE.test(text)) return false;
  if (/^0\s+\d{3}\s/.test(text)) return false;
  if (/^[A-Z]{2,}/.test(text.slice(0, 4))) return false;
  if (/^[a-zçãéõâ(),;:]/.test(text)) return true;
  if (
    text.length < 60 &&
    /^[A-Z][a-zçãéõâ]+/.test(text) &&
    /\b\d+\s*(V|W|Nm|kg|mm|rpm|ipm|bpm|Ah|min|MHz|Hz|°|cm)\b/i.test(text)
  )
    return false;
  if (text.length < 40 && /^[A-Z][a-zçãéõâ]+(\s+[A-Z]?[a-zçãéõâ]+)*\s*$/.test(text))
    return false;
  if (text.length > 80) return true;
  return false;
}

function matchProductHeader(text: string) {
  if (!TIPO_RE.test(text)) return null;
  const m = text.match(
    /([A-Z]{2,4}\s+[\dA-Z][\dA-Z-]+(?:\s+[A-Z]+)?)\s+(\d{2}[A-Z]\d+(?:[.\d]+)?)\s*$/,
  );
  if (!m) {
    const m2 = text.match(/([A-Z]{2,4}\s+[\dA-Z][\dA-Z-]+(?:\s+[A-Z]+)?)\s*$/);
    if (!m2) return null;
    return {
      tipo: text.slice(0, text.length - m2[0].length).trim(),
      modelo: m2[1],
      variante: null,
    };
  }
  return {
    tipo: text.slice(0, text.length - m[0].length).trim(),
    modelo: m[1],
    variante: m[2],
  };
}

function extractProdutosFromLinhas(
  linhas: { y: number; text: string }[],
): Omit<ProdutoExtraido, "page" | "imagens_candidatas_hashes">[] {
  const blocos: {
    tipo: string;
    modelo: string;
    modelo_variante: string | null;
    codigos_pedido: string[];
    tagline: string;
    bullets: string[];
  }[] = [];
  let atual: (typeof blocos)[0] | null = null;
  let ultimoBullet: number | null = null;

  for (const l of linhas) {
    const text = l.text;
    if (!text) {
      ultimoBullet = null;
      continue;
    }
    const tipoCabec = matchProductHeader(text);
    if (tipoCabec) {
      if (atual) blocos.push(atual);
      atual = {
        tipo: tipoCabec.tipo,
        modelo: tipoCabec.modelo,
        modelo_variante: tipoCabec.variante,
        codigos_pedido: [],
        tagline: "",
        bullets: [],
      };
      ultimoBullet = null;
      continue;
    }
    if (!atual) continue;

    const ped = text.match(/0\s+\d{3}\s+\w+\s+\w+/g);
    if (ped) atual.codigos_pedido.push(...ped);

    const b = text.match(BULLET_RE);
    if (b) {
      atual.bullets.push(b[1].trim());
      ultimoBullet = atual.bullets.length - 1;
      continue;
    }
    if (ultimoBullet !== null && isContinuacaoProsa(text)) {
      atual.bullets[ultimoBullet] += " " + text;
      continue;
    }
    if (
      !atual.tagline &&
      text.length > 8 &&
      text.length < 200 &&
      /[a-z]/.test(text)
    ) {
      atual.tagline = text;
      ultimoBullet = null;
      continue;
    }
    ultimoBullet = null;
  }
  if (atual) blocos.push(atual);

  return blocos.map((b) => ({
    tipo: b.tipo,
    modelo: b.modelo,
    modelo_variante: b.modelo_variante,
    codigos_pedido: [...new Set(b.codigos_pedido)],
    tagline: b.tagline,
    bullets: b.bullets,
    descricao: formatDescricao(b),
  }));
}

function formatDescricao(b: { tagline: string; bullets: string[] }): string {
  const parts: string[] = [];
  if (b.tagline) parts.push(b.tagline);
  if (b.bullets.length > 0) {
    parts.push("");
    parts.push(...b.bullets.map((bl) => `• ${bl}`));
  }
  return parts.join("\n");
}
