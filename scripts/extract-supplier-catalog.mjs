/**
 * Extrai catálogo de fornecedor (PDF) → JSON estruturado + imagens
 * desduplicadas e classificadas (produto / lifestyle / decorativo).
 *
 * Uso:
 *   node --experimental-strip-types scripts/extract-supplier-catalog.mjs <pdf> [<pages>] [<out-dir>]
 *
 * Saídas em <out-dir>:
 *   imgs/<sha1>.png       — imagens deduplicadas
 *   index.json            — estrutura completa por página com produtos+imagens
 *   produto.json          — só os produtos (achatado)
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

// ───── Padrões de extração (declarados no topo pra evitar TDZ) ────
const TIPO_RE = /^(PARAFUSADEIRA|FURADEIRA|MARTELETE|ESMERILHADEIRA|SERRA|TUPIA|LIXADEIRA|PLAINA|CHAVE\s+DE\s+IMPACTO|PARAFUSADEIRA[/]FURADEIRA|MARTELO|FRESADORA|GRAMPEADOR|SOPRADOR|ASPIRADOR|HIDROLAVADORA|MULTIPROCESSADORA|JATEADORA|ROUTER|JIG\s*SAW|ROMPEDOR|MULTI[- ]?CORTADORA|TICO[- ]?TICO|RETIFICADEIRA|PISTOLA|COMPRESSOR)/i;
const BULLET_RE = /^[fl•▪-]\s+(.+)/;

const [, , pdfPath, pagesArg, outDirArg] = process.argv;
if (!pdfPath) {
  console.error("Uso: node extract-supplier-catalog.mjs <pdf> [<pages>] [<out-dir>]");
  process.exit(1);
}
const outDir = resolve(outDirArg ?? "./.tmp/supplier");
const imgDir = resolve(outDir, "imgs");
mkdirSync(imgDir, { recursive: true });

const buf = readFileSync(pdfPath);
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
globalThis.pdfjsWorker = worker;
const OPS = pdfjs.OPS;

const doc = await pdfjs.getDocument({
  data: new Uint8Array(buf),
  useSystemFonts: true,
}).promise;

let pageStart = 1;
let pageEnd = doc.numPages;
if (pagesArg) {
  const m = pagesArg.match(/^(\d+)(?:-(\d+))?$/);
  if (m) {
    pageStart = Number(m[1]);
    pageEnd = m[2] ? Number(m[2]) : pageStart;
  }
}

console.log(`PDF: ${pdfPath}`);
console.log(`Total páginas: ${doc.numPages}. Processando ${pageStart}-${pageEnd}.\n`);

/** @type {Map<string, ImageEntry>} */
const imageRegistry = new Map();
const pages = [];

for (let p = pageStart; p <= pageEnd; p++) {
  const page = await doc.getPage(p);
  const text = await page.getTextContent();
  const opList = await page.getOperatorList();

  // ─────── Extrai texto linhas-Y (preserva ordem visual) ────────
  const linhas = textPorLinha(text.items);
  const fullText = linhas.map((l) => l.text).join("\n");

  // ─────── Extrai produtos do texto ─────────────────────────────
  const produtos = extractProdutos(linhas);

  // ─────── Extrai imagens (com dedup) ───────────────────────────
  const imagensDaPagina = [];
  const seenInPage = new Set();
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (
      fn !== OPS.paintImageXObject &&
      fn !== OPS.paintImageXObjectRepeat &&
      fn !== OPS.paintInlineImageXObject
    ) continue;
    const name = opList.argsArray[i][0];
    if (seenInPage.has(name)) continue;
    seenInPage.add(name);

    let img;
    try {
      img = await getImageObj(page, name);
    } catch {
      continue;
    }
    if (!img || !img.width || !img.height || !img.data) continue;
    if (img.width < 80 || img.height < 80) continue; // ícones

    const rgba = toRGBA(img);
    if (!rgba) continue;
    const hash = sha1(rgba);

    // Já vimos antes? Só registra que aparece nessa página.
    if (imageRegistry.has(hash)) {
      imagensDaPagina.push({ hash, ...imageRegistry.get(hash).meta });
      continue;
    }

    const score = scoreImage(rgba, img.width, img.height);
    const tipo = classifyImage(score, img.width, img.height);
    const file = `${hash}.png`;
    writePng(resolve(imgDir, file), rgba, img.width, img.height);

    imageRegistry.set(hash, {
      meta: {
        file,
        w: img.width,
        h: img.height,
        score: round3(score.total),
        tipo,
        white_corners: round3(score.white_corners),
        color: round3(score.color),
        saturation: round3(score.saturation),
        aspect: round3(img.width / img.height),
      },
    });
    imagensDaPagina.push({ hash, ...imageRegistry.get(hash).meta });
  }

  pages.push({
    page: p,
    produtos,
    imagens: imagensDaPagina,
    full_text: fullText.length > 4000 ? fullText.slice(0, 4000) + "..." : fullText,
  });

  const nProd = produtos.length;
  const nImgProduto = imagensDaPagina.filter((i) => i.tipo === "produto").length;
  const nImgLifestyle = imagensDaPagina.filter((i) => i.tipo === "lifestyle").length;
  const nImgDeco = imagensDaPagina.filter((i) => i.tipo === "decorativo").length;
  if (nProd > 0 || nImgProduto > 0) {
    console.log(
      `pág ${String(p).padStart(3)}: ${nProd} produtos · imgs[produto:${nImgProduto} lifestyle:${nImgLifestyle} deco:${nImgDeco}] · ` +
        produtos.map((p) => p.modelo).join(", "),
    );
  }
}

// ─────── Escreve index ─────────────────────────────────────────
const index = {
  pdf: pdfPath,
  pages_processed: `${pageStart}-${pageEnd}`,
  total_pages: doc.numPages,
  total_imagens_unicas: imageRegistry.size,
  total_produtos: pages.reduce((a, p) => a + p.produtos.length, 0),
  pages,
  imagens: Object.fromEntries(
    [...imageRegistry.entries()].map(([h, v]) => [h, v.meta]),
  ),
};
writeFileSync(resolve(outDir, "index.json"), JSON.stringify(index, null, 2));

// produto.json — flat list, com janela de imagens em páginas adjacentes
// quando a página atual não tem foto-produto (capa de seção, layout de
// página dupla, etc).
const produtoFlat = [];
const pageByNum = new Map(pages.map((p) => [p.page, p]));
for (const pg of pages) {
  const imgsProd = pg.imagens.filter((i) => i.tipo === "produto");
  // Vizinhos: olhar só páginas ADJACENTES e que NÃO TENHAM produtos próprios.
  // Isso evita "roubar" foto de outra página de produto.
  const vizinhosImgs = [];
  for (const offset of [-1, 1]) {
    const viz = pageByNum.get(pg.page + offset);
    if (!viz) continue;
    if (viz.produtos.length === 0) {
      vizinhosImgs.push(...viz.imagens.filter((i) => i.tipo === "produto"));
    }
  }
  for (const prod of pg.produtos) {
    const candidatas = [...imgsProd, ...vizinhosImgs];
    // dedup por hash
    const dedup = [];
    const seen = new Set();
    for (const c of candidatas) {
      if (seen.has(c.hash)) continue;
      seen.add(c.hash);
      dedup.push(c);
    }
    produtoFlat.push({
      ...prod,
      page: pg.page,
      imagens_candidatas: dedup.map((i) => i.hash),
    });
  }
}
writeFileSync(resolve(outDir, "produtos.json"), JSON.stringify(produtoFlat, null, 2));

console.log(`\n=== Resumo ===`);
console.log(`Páginas processadas: ${pageEnd - pageStart + 1}`);
console.log(`Produtos detectados: ${index.total_produtos}`);
console.log(`Imagens únicas: ${index.total_imagens_unicas}`);
const tipoCount = {};
for (const v of imageRegistry.values()) tipoCount[v.meta.tipo] = (tipoCount[v.meta.tipo] || 0) + 1;
console.log(`  por tipo:`, tipoCount);
console.log(`\nSaída: ${outDir}`);

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getImageObj(page, name) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (obj) => {
      if (done) return;
      done = true;
      resolve(obj);
    };
    // Timeout: se o callback nunca dispara (imagem não renderizada),
    // resolve com null em 500ms.
    const timer = setTimeout(() => finish(null), 500);
    try {
      if (page.commonObjs.has?.(name)) {
        clearTimeout(timer);
        return finish(page.commonObjs.get(name));
      }
      if (page.objs.has?.(name)) {
        clearTimeout(timer);
        return finish(page.objs.get(name));
      }
      page.objs.get(name, (obj) => {
        clearTimeout(timer);
        finish(obj);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/** Converte qualquer ImageKind para Buffer RGBA. */
function toRGBA(img) {
  const { width, height, kind, data } = img;
  const px = width * height;
  // 3 = RGBA_32BPP, 2 = RGB_24BPP, 1 = GRAYSCALE_1BPP
  if (kind === 3 && data.length >= px * 4) {
    return Buffer.from(data.subarray(0, px * 4));
  }
  if (kind === 2 && data.length >= px * 3) {
    const out = Buffer.alloc(px * 4);
    for (let i = 0, j = 0; i < px * 3; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
    return out;
  }
  if (kind === 1) {
    const out = Buffer.alloc(px * 4);
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = data[y * rowBytes + (x >> 3)];
        const bit = (byte >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const j = (y * width + x) * 4;
        out[j] = v;
        out[j + 1] = v;
        out[j + 2] = v;
        out[j + 3] = 255;
      }
    }
    return out;
  }
  // fallback: tenta como RGBA bruto se tiver bytes suficientes
  if (data.length >= px * 4) {
    return Buffer.from(data.subarray(0, px * 4));
  }
  return null;
}

function writePng(path, rgba, w, h) {
  const png = new PNG({ width: w, height: h });
  png.data = rgba;
  writeFileSync(path, PNG.sync.write(png));
}

function sha1(buf) {
  return createHash("sha1").update(buf).digest("hex").slice(0, 16);
}

/** Heurísticas de imagem-de-produto.
 *
 *  Sinais usados:
 *  - aspect (proximidade de 1:1 ou retrato)
 *  - whiteCorners: % de pixels claros nos 4 cantos (5x5 cada)
 *  - colorRichness: variância em RGB (descarta sólidos/gradientes)
 *  - saturationMean: média da saturação HSV (≈ 0 = imagem mono → máscara)
 *  - lumVariance: variância de luminância (sinal complementar)
 */
function scoreImage(rgba, w, h) {
  const ar = w / h;
  const aspect =
    ar >= 0.5 && ar <= 2.0 ? 1 - Math.abs(1 - ar) * 0.4 : Math.max(0, 0.5 - Math.abs(1 - ar) * 0.3);

  // Cantos uniformes: cada canto 8x8 com variância de luminância baixa
  // = fundo limpo (branco, preto, transparente — não importa). Fotos de
  // produto da Bosch vêm de várias formas: fundo branco, transparente, ou
  // recortadas. O denominador comum é "cantos sem detalhes".
  const cornerSize = 8;
  const corners = [
    [0, 0],
    [w - cornerSize, 0],
    [0, h - cornerSize],
    [w - cornerSize, h - cornerSize],
  ];
  let cleanCornersCount = 0;
  for (const [cx, cy] of corners) {
    const lumsCorner = [];
    for (let dy = 0; dy < cornerSize; dy++) {
      for (let dx = 0; dx < cornerSize; dx++) {
        const px = Math.max(0, Math.min(w - 1, cx + dx));
        const py = Math.max(0, Math.min(h - 1, cy + dy));
        const i = (py * w + px) * 4;
        const a = rgba[i + 3];
        // Pixel transparente = canto limpo (alpha não conta na variância)
        if (a < 30) {
          lumsCorner.push(0);
          continue;
        }
        lumsCorner.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
      }
    }
    const cornerVar = variance(lumsCorner);
    if (cornerVar < 200) cleanCornersCount++;
  }
  const white_corners = cleanCornersCount / 4; // 0, 0.25, 0.5, 0.75, 1

  // Amostra 16x16 grid pra estatísticas globais
  const N = 16;
  const rs = [];
  const gs = [];
  const bs = [];
  const lums = [];
  const sats = [];
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const sx = Math.floor((gx + 0.5) * (w / N));
      const sy = Math.floor((gy + 0.5) * (h / N));
      const i = (sy * w + sx) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      rs.push(r);
      gs.push(g);
      bs.push(b);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max === 0 ? 0 : (max - min) / max;
      lums.push(lum);
      sats.push(sat);
    }
  }
  const lumVar = variance(lums);
  const colorRichness = (variance(rs) + variance(gs) + variance(bs)) / 3;
  const saturationMean = sats.reduce((a, b) => a + b, 0) / sats.length;
  const lumVarNorm = Math.min(lumVar / 5000, 1);
  const colorRichnessNorm = Math.min(colorRichness / 4000, 1);

  // Score composto: prioriza fotos com fundo claro + cor
  const total =
    aspect * 0.15 +
    white_corners * 0.4 +
    colorRichnessNorm * 0.3 +
    lumVarNorm * 0.15;

  return {
    total,
    aspect,
    white_corners,
    color: colorRichnessNorm,
    lum_var: lumVarNorm,
    saturation: saturationMean,
  };
}

function variance(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

function classifyImage(score, w, h) {
  const ar = w / h;
  const isWideBanner = ar > 1.6 || ar < 0.55;

  // Máscara monocromática (alpha stencil): saturação ~0 e alguma variância de lum
  if (score.saturation < 0.05 && score.lum_var > 0.2) return "mascara";

  // Decorativo: quase sem variação (banner sólido, gradiente liso)
  if (score.color < 0.05 && score.lum_var < 0.1) return "decorativo";

  // Lifestyle: cena rica em cor (color alto) — produto puro tem cor MODERADA
  // porque o objeto domina com tons relativamente uniformes.
  if (score.color > 0.7 && Math.min(w, h) >= 130) return "lifestyle";

  // Banner com cena (widescreen + cor) → lifestyle
  if (isWideBanner && score.color > 0.3 && Math.min(w, h) >= 130) return "lifestyle";

  // Produto puro: cantos limpos, aspect próximo de 1, saturação presente, cor moderada
  if (
    !isWideBanner &&
    score.white_corners >= 0.5 &&
    score.saturation > 0.15 &&
    score.color > 0.1 &&
    score.color < 0.7
  )
    return "produto";

  // Produto pequeno (ícone-de-produto, batería, acessório): cantos super-limpos
  if (
    !isWideBanner &&
    score.white_corners >= 0.75 &&
    score.color > 0.1 &&
    Math.min(w, h) >= 60
  )
    return "produto";

  return "outro";
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// ───────── Texto: agrupa items por linha (Y similar) ────────────
function textPorLinha(items) {
  const linhas = [];
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
  linhas.sort((a, b) => b.y - a.y); // top-to-bottom
  return linhas.map((l) => ({
    y: l.y,
    text: l.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim(),
  }));
}

function extractProdutos(linhas) {
  const blocos = [];
  let atual = null;
  let ultimoBullet = null; // referência ao último bullet pra concatenar continuações

  for (const l of linhas) {
    const text = l.text;
    if (!text) {
      ultimoBullet = null;
      continue;
    }

    // Cabeçalho de produto: TIPO ... CÓDIGO_MODELO
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
        specs_text: [],
        _y: l.y,
      };
      ultimoBullet = null;
      continue;
    }
    if (!atual) continue;

    // Códigos de pedido
    const ped = text.match(/0\s+\d{3}\s+\w+\s+\w+/g);
    if (ped) atual.codigos_pedido.push(...ped);

    // Início de bullet
    const b = text.match(BULLET_RE);
    if (b) {
      const bullet = b[1].trim();
      atual.bullets.push(bullet);
      ultimoBullet = atual.bullets.length - 1;
      continue;
    }

    // Continuação de bullet: junta com o bullet anterior se a linha parece
    // prosa (não spec, não cabeçalho, sem unidade técnica óbvia).
    if (ultimoBullet !== null && isContinuacaoProsa(text)) {
      atual.bullets[ultimoBullet] += " " + text;
      continue;
    }

    // Tagline = 1ª linha não-vazia em prosa após o header
    if (!atual.tagline && text.length > 8 && text.length < 200 && /[a-z]/.test(text)) {
      atual.tagline = text;
      ultimoBullet = null;
      continue;
    }

    // Specs (curto, frequentemente termina com unidade)
    if (text.length < 120) atual.specs_text.push(text);
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

/** Detecta se a linha é continuação de bullet anterior (prosa, não spec).
 *
 *  Sinais POSITIVOS de continuação:
 *  - começa com letra minúscula
 *  - começa com `(`, vírgula, ponto-e-vírgula
 *  - linha longa (> 80 chars) — specs costumam ser curtas
 *
 *  Sinais NEGATIVOS (spec/cabeçalho):
 *  - começa com palavra-label capitalizada simples + número/letra (ex: "Bateria 18 V", "Motor Brushless")
 *  - CAIXA-ALTA inicial
 *  - código de pedido Bosch (0 601 ...)
 */
function isContinuacaoProsa(text) {
  if (text.length < 4 || text.length > 250) return false;
  if (TIPO_RE.test(text)) return false;
  if (/^0\s+\d{3}\s/.test(text)) return false;
  if (/^[A-Z]{2,}/.test(text.slice(0, 4))) return false;

  // Sinal forte de continuação: começa com lowercase, parêntese ou pontuação
  if (/^[a-zçãéõâ(),;:]/.test(text)) return true;

  // Sinal forte de spec: "Capitalized 1+ palavras" curto (< 50) com número/unidade no fim
  if (
    text.length < 60 &&
    /^[A-Z][a-zçãéõâ]+/.test(text) &&
    /\b\d+\s*(V|W|Nm|kg|mm|rpm|ipm|bpm|Ah|min|MHz|Hz|°|cm)\b/i.test(text)
  )
    return false;

  // Capitalized + apenas palavras (ex: "Motor Brushless") = spec
  if (text.length < 40 && /^[A-Z][a-zçãéõâ]+(\s+[A-Z]?[a-zçãéõâ]+)*\s*$/.test(text))
    return false;

  // Caso intermediário: linha longa começando com Capitalized → mais provável prosa
  if (text.length > 80) return true;

  return false;
}

function matchProductHeader(text) {
  // Padrão observado: "PARAFUSADEIRA/FURADEIRA 1/2"   GSR 185-LI 19K3.0"
  // ou: "CHAVE DE IMPACTO 1/2"   GDS 18V-400 19K0.0"
  // O modelo está no final, em CAIXA_ALTA + número.
  if (!TIPO_RE.test(text)) return null;
  // Procura modelo no final
  const m = text.match(/([A-Z]{2,4}\s+[\dA-Z][\dA-Z-]+(?:\s+[A-Z]+)?)\s+(\d{2}[A-Z]\d+(?:[.\d]+)?)\s*$/);
  if (!m) {
    // Tenta sem variante
    const m2 = text.match(/([A-Z]{2,4}\s+[\dA-Z][\dA-Z-]+(?:\s+[A-Z]+)?)\s*$/);
    if (!m2) return null;
    const modelo = m2[1];
    const tipo = text.slice(0, text.length - m2[0].length).trim();
    return { tipo, modelo, variante: null };
  }
  const modelo = m[1];
  const variante = m[2];
  const tipo = text.slice(0, text.length - m[0].length).trim();
  return { tipo, modelo, variante };
}

function formatDescricao(b) {
  const parts = [];
  if (b.tagline) parts.push(b.tagline);
  if (b.bullets.length > 0) {
    parts.push("");
    parts.push(...b.bullets.map((bl) => `• ${bl}`));
  }
  return parts.join("\n");
}
