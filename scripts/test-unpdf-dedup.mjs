import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractImages, getDocumentProxy } from "unpdf";

const buf = readFileSync(process.argv[2] ?? "C:/Users/Gabriel/Downloads/catalogo_de_produtos_bosch-_web-compactado.pdf");
const t0 = Date.now();
const pdf = await getDocumentProxy(new Uint8Array(buf));
console.log(`PDF aberto: ${pdf.numPages} páginas`);

const seen = new Set();
let totalDecoded = 0;
let totalFailed = 0;

const orig = console.warn;
console.warn = () => {};

for (let p = 1; p <= pdf.numPages; p++) {
  let images = [];
  try { images = await extractImages(pdf, p); } catch (e) { totalFailed++; continue; }
  for (const img of images) {
    if (img.width < 80 || img.height < 80) continue;
    if (!img.data) continue;
    const h = createHash("sha1").update(img.data).digest("hex").slice(0, 16);
    if (seen.has(h)) continue;
    seen.add(h);
    totalDecoded++;
  }
  if (p % 30 === 0) console.log(`progresso ${p}/${pdf.numPages}: ${totalDecoded} únicas`);
}
console.warn = orig;
console.log(`\nTotal único decodificado: ${totalDecoded}`);
console.log(`Tempo: ${Date.now() - t0}ms`);
