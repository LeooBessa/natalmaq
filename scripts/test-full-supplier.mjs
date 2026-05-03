import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2] ?? "C:/Users/Gabriel/Downloads/catalogo_de_produtos_bosch-_web-compactado.pdf");
const t0 = Date.now();
const { extractSupplierCatalog } = await import("../lib/supplier-catalog.ts");

let lastP = 0;
const result = await extractSupplierCatalog(buf, {
  onProgress: (p, total) => {
    if (p % 20 === 0 || p === total) console.log(`progress ${p}/${total}`);
    lastP = p;
  },
});
const ms = Date.now() - t0;
console.log(`\n=== Resultado em ${ms}ms ===`);
console.log(`Páginas: ${result.total_paginas}`);
console.log(`Produtos detectados: ${result.produtos.length}`);
console.log(`Imagens únicas: ${result.imagens.size}`);

const tipos = {};
for (const img of result.imagens.values()) tipos[img.tipo] = (tipos[img.tipo] || 0) + 1;
console.log(`Por tipo:`, tipos);
