/**
 * Busca foto + título de produtos sem imagem na API do Mercado Livre e grava
 * candidatos em `produto_enriquecimento` para revisão no admin.
 *
 * Pré-requisitos:
 *  - migration 0010_enriquecimento.sql aplicada
 *  - access_token do Mercado Livre (use scripts/ml-token.mjs para obter)
 *
 * Uso:
 *   node --env-file=.env.local scripts/buscar-fotos-ml.mjs <ml-access-token> [--min-score=25] [--limite=N]
 *
 *   --min-score=N   só grava candidatos com score >= N (padrão 25)
 *   --limite=N      processa no máximo N produtos (padrão: todos)
 *
 * É resumível: produtos que já têm candidato são pulados. Se o token expirar
 * (~6h), gere outro com ml-token.mjs e rode de novo — continua de onde parou.
 *
 * Lê do .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const [, , token, ...flags] = process.argv;
const minScore = Number((flags.find((f) => f.startsWith("--min-score=")) ?? "").split("=")[1]) || 25;
const limite = Number((flags.find((f) => f.startsWith("--limite=")) ?? "").split("=")[1]) || Infinity;

if (!token) {
  console.error("Uso: node --env-file=.env.local scripts/buscar-fotos-ml.mjs <ml-access-token> [--min-score=25] [--limite=N]");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com: node --env-file=.env.local ...");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────── normalização / score ─────────────────────────
function tokens(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 2);
}

// Mede o quanto o título do ML cobre as palavras do nome do produto.
function calcularScore(nomeProduto, marca, tituloML) {
  const pt = [...new Set(tokens(nomeProduto))];
  const tt = new Set(tokens(tituloML));
  if (pt.length === 0 || tt.size === 0) return 0;
  let comuns = 0;
  for (const t of pt) if (tt.has(t)) comuns++;
  let s = (comuns / pt.length) * 100;
  // Bônus se a marca também aparece no título.
  const mt = tokens(marca);
  if (mt.length > 0 && mt.every((t) => tt.has(t))) s += 15;
  return Math.min(100, Math.round(s * 10) / 10);
}

// Aumenta a resolução do thumbnail do ML.
function imagemGrande(thumb) {
  if (!thumb) return null;
  return thumb
    .replace(/^http:/, "https:")
    .replace(/-I\.(jpg|webp|png)/i, "-O.$1")
    .replace("D_NQ_NP_", "D_NQ_NP_2X_");
}

async function buscarML(query) {
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=10`;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 401 || resp.status === 403) throw new Error("TOKEN_INVALIDO");
    if (resp.status === 429) { await sleep(2000); continue; }
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  }
  return [];
}

// ──────────────────────────────────── main ──────────────────────────────────
async function main() {
  // 1) Produtos sem foto (paginado).
  const produtos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("produtos")
      .select("id, codigo, nome, imagens, marca:marcas(nome)")
      .or("imagens.is.null,imagens.eq.[]")
      .range(from, from + 999);
    if (error) throw new Error("Erro ao ler produtos: " + error.message);
    if (!data || data.length === 0) break;
    produtos.push(...data);
    if (data.length < 1000) break;
  }

  // 2) Produtos que já têm candidato (resumível).
  const jaTem = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("produto_enriquecimento")
      .select("produto_id")
      .range(from, from + 999);
    if (error) throw new Error("Erro ao ler candidatos: " + error.message);
    if (!data || data.length === 0) break;
    for (const r of data) jaTem.add(r.produto_id);
    if (data.length < 1000) break;
  }

  const fila = produtos.filter((p) => !jaTem.has(p.id)).slice(0, limite);
  console.log(`${produtos.length} produtos sem foto · ${jaTem.size} já processados · ${fila.length} na fila\n`);

  let comCandidato = 0;
  let semMatch = 0;
  let lote = [];

  async function flush() {
    if (lote.length === 0) return;
    const { error } = await sb
      .from("produto_enriquecimento")
      .upsert(lote, { onConflict: "produto_id", ignoreDuplicates: true });
    if (error) console.error("  ! erro ao gravar lote:", error.message);
    lote = [];
  }

  for (let i = 0; i < fila.length; i++) {
    const p = fila[i];
    const marca = p.marca?.nome ?? "";
    const query = `${marca} ${p.nome}`.trim().slice(0, 120);

    let resultados;
    try {
      resultados = await buscarML(query);
    } catch (e) {
      if (e.message === "TOKEN_INVALIDO") {
        await flush();
        console.error(`\n⚠️  Token do Mercado Livre inválido/expirado na linha ${i + 1}.`);
        console.error("Gere outro com ml-token.mjs e rode de novo — continua de onde parou.");
        process.exit(1);
      }
      throw e;
    }

    // Escolhe o melhor resultado por score.
    let melhor = null;
    for (const r of resultados) {
      if (!r.thumbnail) continue;
      const s = calcularScore(p.nome, marca, r.title);
      if (!melhor || s > melhor.score) melhor = { r, score: s };
    }

    if (melhor && melhor.score >= minScore) {
      lote.push({
        produto_id: p.id,
        fonte: "mercadolivre",
        ml_item_id: melhor.r.id,
        titulo: melhor.r.title,
        imagem_url: imagemGrande(melhor.r.thumbnail),
        url_origem: melhor.r.permalink ?? null,
        preco_origem: typeof melhor.r.price === "number" ? melhor.r.price : null,
        score: melhor.score,
        status: "pendente",
      });
      comCandidato++;
    } else {
      semMatch++;
    }

    if (lote.length >= 100) await flush();
    if ((i + 1) % 200 === 0) {
      console.log(`  ${i + 1}/${fila.length} · ${comCandidato} candidatos · ${semMatch} sem match`);
    }
    await sleep(150);
  }
  await flush();

  console.log(`\nConcluído: ${comCandidato} candidatos gravados · ${semMatch} sem match suficiente (score < ${minScore})`);
  console.log("Revise em /admin/enriquecimento");
}

main().catch((e) => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});
