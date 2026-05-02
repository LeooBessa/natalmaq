import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2] ?? "C:/Users/Gabriel/Downloads/CONSULTA DE PRODUTOS.pdf");
const { extractProdutosFromPdf } = await import("../lib/pdf-parser.ts");
const { extractCategoria, clusterVariantes, extractVarianteLabel } = await import("../lib/agrupador.ts");

const { rows } = await extractProdutosFromPdf(buf);
console.log(`Total produtos: ${rows.length}`);

// --- categorias ---
const catCount = new Map();
for (const r of rows) {
  const c = extractCategoria(r.descricao);
  if (!c) continue;
  catCount.set(c.slug, (catCount.get(c.slug) ?? 0) + 1);
}
console.log(`\nTotal categorias únicas: ${catCount.size}`);
const catTop = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(`Top 25 categorias:`);
for (const [slug, n] of catTop) console.log(`  ${slug}: ${n}`);

// --- clusters de variantes ---
const clusters = clusterVariantes(rows);
console.log(`\nTotal clusters de variantes: ${clusters.length}`);
const totalVariantes = clusters.reduce((acc, c) => acc + c.itens.length, 0);
console.log(`Produtos em clusters: ${totalVariantes} de ${rows.length} (${((totalVariantes / rows.length) * 100).toFixed(1)}%)`);

console.log(`\nMaiores 8 clusters:`);
const big = clusters.slice().sort((a, b) => b.itens.length - a.itens.length).slice(0, 8);
for (const c of big) {
  console.log(`\n  [${c.fabricante}] "${c.prefixo}" (${c.itens.length} variantes)`);
  for (const p of c.itens.slice(0, 6)) {
    const lbl = extractVarianteLabel(p.descricao, c.prefixo);
    console.log(`    ${p.codigo}: "${lbl}"`);
  }
  if (c.itens.length > 6) console.log(`    ...e mais ${c.itens.length - 6}`);
}

console.log(`\nAmostra clusters pequenos (3 aleatórios com 2-3 variantes):`);
const small = clusters.filter((c) => c.itens.length <= 3).slice(0, 3);
for (const c of small) {
  console.log(`  [${c.fabricante}] "${c.prefixo}" (${c.itens.length})`);
  for (const p of c.itens) {
    console.log(`    ${p.codigo}: "${extractVarianteLabel(p.descricao, c.prefixo)}"`);
  }
}
