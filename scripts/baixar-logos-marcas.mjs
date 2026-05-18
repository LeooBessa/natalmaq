/**
 * Baixa logos das marcas principais via logo.dev, sobe pro Supabase Storage
 * (bucket `marketing`) e atualiza `marcas.logo_url`.
 *
 * Uso:
 *   node --env-file=.env.local scripts/baixar-logos-marcas.mjs <token-logo.dev> [--force]
 *
 *   <token-logo.dev>  token público (pk_...) de logo.dev
 *   --force           sobrescreve logos que já existem (por padrão, pula)
 *
 * Lê do .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const [, , token, ...flags] = process.argv;
const force = flags.includes("--force");

if (!token || !token.startsWith("pk_")) {
  console.error("Uso: node --env-file=.env.local scripts/baixar-logos-marcas.mjs <token-logo.dev> [--force]");
  console.error("O token deve começar com 'pk_' (token público de logo.dev).");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com: node --env-file=.env.local ...");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Marcas principais do catálogo → domínio oficial.
// A chave é o `slug` exato da marca no banco.
const MARCAS = {
  bosch: "bosch.com",
  makita: "makita.com",
  dewalt: "dewalt.com",
  stanley: "stanleytools.com",
  tramontina: "tramontina.com",
  vonder: "vonder.com.br",
  karcher: "kaercher.com",
  schulz: "schulz.com.br",
  tigre: "tigre.com.br",
  irwin: "irwintools.com",
  dremel: "dremel.com",
  skil: "skil.com",
  einhell: "einhell.com",
  esab: "esab.com",
  norton: "nortonabrasives.com",
  mitutoyo: "mitutoyo.com",
  starrett: "starrett.com",
  gedore: "gedore.com",
  "king-tony": "kingtony.com",
  loctite: "loctite.com",
  henkel: "henkel.com",
  "faber-caste": "faber-castell.com",
  osram: "osram.com",
  panasonic: "panasonic.com",
  vipal: "vipal.com.br",
  toyama: "toyama.com.br",
  lynus: "lynus.com.br",
  skf: "skf.com",
  nsk: "nsk.com",
  tyrolit: "tyrolit.com",
  marluvas: "marluvas.com.br",
  msa: "msasafety.com",
  worker: "worker.com.br",
  foxlux: "foxlux.com.br",
  hikari: "hikari.com.br",
  minipa: "minipa.com.br",
  balmer: "balmer.com.br",
  chiaperini: "chiaperini.com.br",
  lavorwash: "lavorwash.com",
  pado: "pado.com.br",
  empalux: "empalux.com.br",
  steck: "steck.com.br",
  cortag: "cortag.com.br",
  gamma: "gammaferramentas.com.br",
  "3m": "3m.com",
  gerdau: "gerdau.com",
};

async function main() {
  // Marcas existentes no banco (paginado).
  const existentes = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("marcas")
      .select("id, slug, logo_url")
      .range(from, from + 999);
    if (error) throw new Error("Erro ao ler marcas: " + error.message);
    if (!data || data.length === 0) break;
    for (const m of data) existentes.set(m.slug, m);
    if (data.length < 1000) break;
  }

  let ok = 0;
  let pulados = 0;
  let falhas = 0;

  for (const [slug, dominio] of Object.entries(MARCAS)) {
    const marca = existentes.get(slug);
    if (!marca) {
      console.log(`–  ${slug.padEnd(14)} não existe no banco, ignorado`);
      continue;
    }
    if (marca.logo_url && !force) {
      console.log(`•  ${slug.padEnd(14)} já tem logo (use --force p/ trocar)`);
      pulados++;
      continue;
    }

    try {
      // 1) Baixa a logo do logo.dev
      const url = `https://img.logo.dev/${dominio}?token=${token}&format=png&size=256&retina=true`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.log(`✗  ${slug.padEnd(14)} logo.dev respondeu ${resp.status}`);
        falhas++;
        continue;
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length < 200) {
        console.log(`✗  ${slug.padEnd(14)} imagem vazia/inválida`);
        falhas++;
        continue;
      }

      // 2) Sobe pro Storage (bucket público `marketing`)
      const path = `marcas/${slug}.png`;
      const { error: errUp } = await sb.storage
        .from("marketing")
        .upload(path, buffer, { contentType: "image/png", upsert: true });
      if (errUp) {
        console.log(`✗  ${slug.padEnd(14)} falha no upload: ${errUp.message}`);
        falhas++;
        continue;
      }
      const { data: pub } = sb.storage.from("marketing").getPublicUrl(path);

      // 3) Atualiza a marca
      const { error: errUpd } = await sb
        .from("marcas")
        .update({ logo_url: pub.publicUrl })
        .eq("id", marca.id);
      if (errUpd) {
        console.log(`✗  ${slug.padEnd(14)} falha ao atualizar: ${errUpd.message}`);
        falhas++;
        continue;
      }

      console.log(`✓  ${slug.padEnd(14)} ${(buffer.length / 1024).toFixed(1)} KB`);
      ok++;
    } catch (e) {
      console.log(`✗  ${slug.padEnd(14)} ${e.message}`);
      falhas++;
    }
  }

  console.log(`\nConcluído: ${ok} logos aplicadas · ${pulados} puladas · ${falhas} falhas`);
}

main().catch((e) => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});
