// Script de validação local — extrai produtos do PDF e mostra estatísticas.
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Roda o TS via tsx-style import (assume node@22+ com --experimental-strip-types).
// Como alternativa, importamos a versão compilada se necessário.
const buf = readFileSync(process.argv[2] ?? "C:/Users/Gabriel/Downloads/CONSULTA DE PRODUTOS.pdf");

const { extractProdutosFromPdf } = await import("../lib/pdf-parser.ts");
const t0 = Date.now();
const { rows, warnings } = await extractProdutosFromPdf(buf);
const ms = Date.now() - t0;

console.log(`\n=== Resultado: ${rows.length} produtos em ${ms}ms ===`);
console.log(`Warnings: ${warnings.length}`);
if (warnings.length) console.log(warnings.slice(0, 5).join("\n"));

console.log("\n=== Primeiros 10 produtos ===");
for (const r of rows.slice(0, 10)) {
  console.log(JSON.stringify(r));
}

console.log("\n=== Últimos 3 produtos ===");
for (const r of rows.slice(-3)) {
  console.log(JSON.stringify(r));
}

const semDescricao = rows.filter((r) => !r.descricao).length;
const semFabricante = rows.filter((r) => !r.fabricante).length;
const semEstoque = rows.filter((r) => r.estoque === null).length;
const fabricantesUnicos = new Set(rows.map((r) => r.fabricante).filter(Boolean));

console.log(`\n=== Estatísticas ===`);
console.log(`Sem descrição: ${semDescricao}`);
console.log(`Sem fabricante: ${semFabricante}`);
console.log(`Sem estoque: ${semEstoque}`);
console.log(`Fabricantes únicos: ${fabricantesUnicos.size}`);
console.log(`Amostra fabricantes: ${[...fabricantesUnicos].slice(0, 15).join(", ")}`);
