// Extrai imagens raster embutidas em um PDF de catálogo de fornecedor.
// Uso: node --experimental-strip-types scripts/extract-pdf-images.mjs <pdf-path> [<pages>] [<out-dir>]
//   pages: "1-10" (default: tudo)
//   out-dir: default ./.tmp/pdf-images

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const [, , pdfPath, pagesArg, outDirArg] = process.argv;
if (!pdfPath) {
  console.error("Uso: node extract-pdf-images.mjs <pdf> [<pages>] [<out-dir>]");
  process.exit(1);
}
const outDir = resolve(outDirArg ?? "./.tmp/pdf-images");
mkdirSync(outDir, { recursive: true });

const buf = readFileSync(pdfPath);

// Carrega worker primeiro.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
globalThis.pdfjsWorker = worker;

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
console.log(`Total: ${doc.numPages} páginas. Processando ${pageStart}-${pageEnd}.`);
console.log(`Saída: ${outDir}\n`);

const OPS = pdfjs.OPS;
const summary = [];

for (let p = pageStart; p <= pageEnd; p++) {
  const page = await doc.getPage(p);
  const opList = await page.getOperatorList();

  // Coleta nomes de imagens
  const imageOps = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageMaskXObject
    ) {
      imageOps.push({ name: opList.argsArray[i][0], op: fn });
    }
  }

  if (imageOps.length === 0) continue;

  // Texto da página (pra identificar produtos depois).
  const text = await page.getTextContent();
  const linhas = [...new Set(text.items.map((it) => it.str.trim()).filter(Boolean))];
  const codigos = extractCodigosBosch(linhas.join(" "));

  let savedCount = 0;
  const seen = new Set();
  for (const imgOp of imageOps) {
    const { name } = imgOp;
    if (seen.has(name)) continue;
    seen.add(name);

    let img;
    try {
      img = await getImageObj(page, name);
    } catch (e) {
      continue;
    }
    if (!img || !img.width || !img.height || !img.data) continue;
    // Filtro: ignora imagens muito pequenas (ícones decorativos).
    if (img.width < 120 || img.height < 120) continue;

    const filename = `p${String(p).padStart(3, "0")}_${sanitize(name)}_${img.width}x${img.height}.png`;
    const outPath = resolve(outDir, filename);
    try {
      writePng(outPath, img);
      savedCount++;
    } catch (e) {
      console.warn(`  pág ${p}: falhou ${name} — ${e.message}`);
    }
  }

  summary.push({
    page: p,
    images_saved: savedCount,
    images_total: imageOps.length,
    codigos: codigos.slice(0, 5),
    primeira_linha: linhas[0]?.slice(0, 80),
  });

  if (savedCount > 0) {
    console.log(
      `pág ${String(p).padStart(3)}: ${savedCount} img salvas · códigos: ${codigos.slice(0, 3).join(", ") || "—"}`,
    );
  }
}

console.log(`\n=== Resumo ===`);
const totalImgs = summary.reduce((a, b) => a + b.images_saved, 0);
const pagesWithImg = summary.filter((s) => s.images_saved > 0).length;
console.log(`${totalImgs} imagens salvas em ${pagesWithImg} páginas`);
writeFileSync(
  resolve(outDir, "_index.json"),
  JSON.stringify(summary, null, 2),
);
console.log(`Index: ${resolve(outDir, "_index.json")}`);

function getImageObj(page, name) {
  return new Promise((resolve, reject) => {
    try {
      // commonObjs primeiro (resources compartilhados), senão objs.
      const obj = page.commonObjs.has(name)
        ? page.commonObjs.get(name)
        : null;
      if (obj) return resolve(obj);
      page.objs.get(name, (obj) => resolve(obj));
    } catch (e) {
      reject(e);
    }
  });
}

function writePng(path, img) {
  const { width, height, kind, data } = img;
  // pdfjs ImageKind: 1=Grayscale1bpp, 2=RGB_24BPP, 3=RGBA_32BPP
  // Convertemos tudo pra RGBA e gravamos PNG.
  const png = new PNG({ width, height });
  if (kind === 3) {
    png.data = Buffer.from(data);
  } else if (kind === 2) {
    // RGB → RGBA
    const out = Buffer.alloc(width * height * 4);
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out[j] = data[i];
      out[j + 1] = data[i + 1];
      out[j + 2] = data[i + 2];
      out[j + 3] = 255;
    }
    png.data = out;
  } else if (kind === 1) {
    // Grayscale 1bpp packed → expandir
    const out = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = data[(y * Math.ceil(width / 8)) + (x >> 3)];
        const bit = (byte >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const j = (y * width + x) * 4;
        out[j] = v;
        out[j + 1] = v;
        out[j + 2] = v;
        out[j + 3] = 255;
      }
    }
    png.data = out;
  } else {
    // Tenta como RGBA bruto
    if (data.length >= width * height * 4) {
      png.data = Buffer.from(data.subarray(0, width * height * 4));
    } else {
      throw new Error(`kind ${kind} não suportado, ${data.length} bytes`);
    }
  }
  writeFileSync(path, PNG.sync.write(png));
}

function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
}

// Extrai códigos típicos da Bosch (GSR 185-LI, GBH 2-26, 0 601 9K3 0E1, etc)
function extractCodigosBosch(text) {
  const out = new Set();
  // Padrões: 2-4 letras maiúsculas + espaço + código alfanumérico
  for (const m of text.matchAll(/\b([A-Z]{2,4}\s+\d{1,3}[A-Z0-9-]*\b(?:\s+[A-Z0-9-]+)?)/g)) {
    out.add(m[1].trim());
  }
  // Padrão de pedido Bosch: "0 601 ..."
  for (const m of text.matchAll(/\b0\s+\d{3}\s+\S+\s+\S+\b/g)) {
    out.add(m[0].trim());
  }
  return [...out];
}
