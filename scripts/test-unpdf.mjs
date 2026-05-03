import { readFileSync } from "node:fs";
import { extractImages, getDocumentProxy } from "unpdf";

const buf = readFileSync(process.argv[2] ?? "C:/Users/Gabriel/Downloads/catalogo_de_produtos_bosch-_web-compactado.pdf");
const t0 = Date.now();
const pdf = await getDocumentProxy(new Uint8Array(buf));
console.log(`PDF aberto: ${pdf.numPages} páginas em ${Date.now() - t0}ms`);

let total = 0;
for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
  const t = Date.now();
  let images = [];
  try { images = await extractImages(pdf, p); } catch (e) {
    console.log(`p${p}: ERRO - ${e.message}`);
    continue;
  }
  total += images.length;
  if (images.length > 0) console.log(`p${p}: ${images.length} imgs (${Date.now() - t}ms)`);
}
console.log(`\nTotal nas primeiras 30 páginas: ${total}`);
