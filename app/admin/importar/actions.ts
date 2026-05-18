"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractProdutosFromPdf } from "@/lib/pdf-parser";
import {
  clusterVariantes,
  extractCategoria,
  extractVarianteLabel,
} from "@/lib/agrupador";

type LinhaErro = { linha: number; codigo?: string; motivo: string };

type Row = Record<string, string | number | undefined>;

function n(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

function s(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const x = String(v).trim();
  return x === "" ? null : x;
}

function bool(v: unknown): boolean | null {
  if (v === undefined || v === null || v === "") return null;
  const x = String(v).toLowerCase().trim();
  return ["1", "true", "sim", "ativo", "yes", "y"].includes(x);
}

function slugify(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type ImportResult = {
  ok: boolean;
  total?: number;
  atualizados?: number;
  inseridos?: number;
  variantes?: number;
  erros?: LinhaErro[];
  error?: string;
  importId?: string;
};

/**
 * Recebe apenas o caminho do arquivo já enviado ao Storage (bucket `imports`).
 * O upload é feito direto do navegador para o Supabase, evitando o limite de
 * ~4,5 MB que a Vercel impõe ao corpo de Server Actions.
 */
export async function importarPlanilhaAction(input: {
  storage_path: string;
  filename: string;
  criar_novos: boolean;
}): Promise<ImportResult> {
  const { storage_path, filename, criar_novos } = input;
  if (!storage_path || !filename) {
    return { ok: false, error: "Arquivo não enviado" };
  }

  const sb = await createSupabaseServerClient();
  const { data: blob, error: errDl } = await sb.storage
    .from("imports")
    .download(storage_path);
  if (errDl || !blob) {
    return {
      ok: false,
      error: "Falha ao baixar o arquivo do Storage: " + (errDl?.message ?? "desconhecido"),
    };
  }

  const file = new File([blob], filename, { type: blob.type });
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") {
    return importarPdf(file, criar_novos);
  }
  return importarPlanilha(file, criar_novos);
}

// ============================================================================
// CSV / XLSX
// ============================================================================
async function importarPlanilha(
  file: File,
  criarNovos: boolean,
): Promise<ImportResult> {
  const sb = await createSupabaseServerClient();

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Row[];
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  } catch (e) {
    return { ok: false, error: "Não consegui ler a planilha: " + (e as Error).message };
  }
  if (rows.length === 0) return { ok: false, error: "Planilha vazia" };

  const tipo = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  const { data: importRec, error: errImp } = await sb
    .from("imports")
    .insert({
      tipo,
      arquivo_path: file.name,
      criar_novos: criarNovos,
      linhas_total: rows.length,
      status: "processando",
      iniciado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (errImp) return { ok: false, error: errImp.message };
  const importId = importRec.id;

  const [{ data: marcas }, { data: categorias }] = await Promise.all([
    sb.from("marcas").select("id, slug"),
    sb.from("categorias").select("id, slug"),
  ]);
  const marcaPorSlug = new Map((marcas ?? []).map((m) => [m.slug, m.id]));
  const catPorSlug = new Map((categorias ?? []).map((c) => [c.slug, c.id]));

  let atualizados = 0;
  let inseridos = 0;
  const erros: LinhaErro[] = [];

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    const r = normalizeKeys(rows[i]);
    const codigo = s(r.codigo);
    if (!codigo) {
      erros.push({ linha, motivo: "coluna 'codigo' vazia" });
      continue;
    }

    const preco = n(r.preco);
    const estoque = n(r.estoque);
    const nome = s(r.nome);
    const descricao = s(r.descricao);
    const marcaSlug = s(r.marca_slug);
    const categoriaSlug = s(r.categoria_slug);
    const peso_kg = n(r.peso_kg);
    const ativo = bool(r.ativo);
    const destaque = bool(r.destaque);
    const preco_promocional = n(r.preco_promocional);

    const update: Record<string, unknown> = {};
    if (preco !== null) update.preco = preco;
    if (estoque !== null) update.estoque = Math.max(0, Math.floor(estoque));
    if (nome) update.nome = nome;
    if (descricao !== null) update.descricao = descricao;
    if (peso_kg !== null) update.peso_kg = peso_kg;
    if (ativo !== null) update.ativo = ativo;
    if (destaque !== null) update.destaque = destaque;
    if (preco_promocional !== null) update.preco_promocional = preco_promocional;
    if (marcaSlug) {
      const mid = marcaPorSlug.get(marcaSlug);
      if (mid) update.marca_id = mid;
      else erros.push({ linha, codigo, motivo: `marca '${marcaSlug}' não encontrada (ignorada)` });
    }
    if (categoriaSlug) {
      const cid = catPorSlug.get(categoriaSlug);
      if (cid) update.categoria_id = cid;
      else erros.push({ linha, codigo, motivo: `categoria '${categoriaSlug}' não encontrada (ignorada)` });
    }

    const { data: existente } = await sb
      .from("produtos")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();

    if (existente) {
      if (Object.keys(update).length === 0) continue;
      const { error: errUp } = await sb
        .from("produtos")
        .update(update)
        .eq("id", existente.id);
      if (errUp) erros.push({ linha, codigo, motivo: errUp.message });
      else atualizados++;
    } else {
      if (!criarNovos) {
        erros.push({ linha, codigo, motivo: "produto não existe e 'criar novos' está desligado" });
        continue;
      }
      if (!nome || preco === null) {
        erros.push({ linha, codigo, motivo: "novo produto requer nome e preco" });
        continue;
      }
      const insert = {
        codigo,
        slug: slugify(nome),
        nome,
        descricao,
        preco,
        preco_promocional,
        estoque: estoque !== null ? Math.max(0, Math.floor(estoque)) : 0,
        peso_kg: peso_kg ?? 0,
        ativo: ativo ?? true,
        destaque: destaque ?? false,
        marca_id: marcaSlug ? marcaPorSlug.get(marcaSlug) ?? null : null,
        categoria_id: categoriaSlug ? catPorSlug.get(categoriaSlug) ?? null : null,
        imagens: [],
      };
      const { error: errIn } = await sb.from("produtos").insert(insert);
      if (errIn) erros.push({ linha, codigo, motivo: errIn.message });
      else inseridos++;
    }
  }

  await sb
    .from("imports")
    .update({
      status: "concluido",
      linhas_ok: atualizados + inseridos,
      linhas_erro: erros.length,
      detalhes: erros,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", importId);

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/dashboard");

  return { ok: true, total: rows.length, atualizados, inseridos, erros, importId };
}

// ============================================================================
// PDF (Tabela de Produtos — Delphi Sistemas) — batch upsert
// ============================================================================
const BATCH_SIZE = 500;

async function importarPdf(
  file: File,
  criarNovos: boolean,
): Promise<ImportResult> {
  const sb = await createSupabaseServerClient();

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await extractProdutosFromPdf(buf);
  } catch (e) {
    return { ok: false, error: "Falha ao ler o PDF: " + (e as Error).message };
  }
  const { rows, warnings } = parsed;
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "Nenhuma linha reconhecida no PDF. " +
        (warnings[0] ?? "Verifique se o PDF tem o formato esperado."),
    };
  }

  const { data: importRec, error: errImp } = await sb
    .from("imports")
    .insert({
      tipo: "pdf",
      arquivo_path: file.name,
      criar_novos: criarNovos,
      linhas_total: rows.length,
      status: "processando",
      iniciado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (errImp) return { ok: false, error: errImp.message };
  const importId = importRec.id;

  const erros: LinhaErro[] = warnings.map((w, i) => ({
    linha: -i - 1,
    motivo: w,
  }));

  // ------------------------------------------------------------- 1. categorias
  // Deriva categoria da primeira palavra da descrição.
  const categoriasNoPdf = new Map<string, { nome: string; slug: string }>();
  for (const r of rows) {
    const c = extractCategoria(r.descricao);
    if (c) categoriasNoPdf.set(c.slug, c);
  }

  const { data: catsExistentes } = await sb
    .from("categorias")
    .select("id, slug");
  const catPorSlug = new Map<string, string>(
    (catsExistentes ?? []).map((c) => [c.slug, c.id]),
  );

  if (criarNovos) {
    const novasCats = [...categoriasNoPdf.values()].filter(
      (c) => !catPorSlug.has(c.slug),
    );
    if (novasCats.length > 0) {
      const { data: criadas, error: errCats } = await sb
        .from("categorias")
        .insert(novasCats)
        .select("id, slug");
      if (errCats) {
        erros.push({ linha: 0, motivo: `Criar categorias: ${errCats.message}` });
      } else {
        for (const c of criadas ?? []) catPorSlug.set(c.slug, c.id);
      }
    }
  }

  // ---------------------------------------------------------------- 2. marcas
  // Pre-fetch marcas existentes.
  const { data: marcas } = await sb.from("marcas").select("id, nome, slug");
  const marcaPorNome = new Map<string, string>(
    (marcas ?? []).map((m) => [m.nome.toLowerCase().trim(), m.id]),
  );
  const slugsExistentes = new Set<string>((marcas ?? []).map((m) => m.slug));

  // Identifica fabricantes únicos do PDF.
  const fabricantesUnicos = new Map<string, string>(); // key lower → original
  for (const r of rows) {
    if (!r.fabricante) continue;
    const key = r.fabricante.toLowerCase().trim();
    if (!fabricantesUnicos.has(key)) fabricantesUnicos.set(key, r.fabricante);
  }

  // Insere marcas faltantes em UM round-trip.
  if (criarNovos) {
    const novasMarcas: { nome: string; slug: string }[] = [];
    for (const [key, nome] of fabricantesUnicos) {
      if (marcaPorNome.has(key)) continue;
      const baseSlug = slugify(nome);
      if (!baseSlug) continue;
      let candidate = baseSlug;
      let i = 2;
      while (slugsExistentes.has(candidate)) candidate = `${baseSlug}-${i++}`;
      slugsExistentes.add(candidate);
      novasMarcas.push({ nome, slug: candidate });
    }
    if (novasMarcas.length > 0) {
      const { data: criadas, error: errMarcas } = await sb
        .from("marcas")
        .insert(novasMarcas)
        .select("id, nome");
      if (errMarcas) {
        erros.push({ linha: 0, motivo: `Criar marcas: ${errMarcas.message}` });
      } else {
        for (const m of criadas ?? []) {
          marcaPorNome.set(m.nome.toLowerCase().trim(), m.id);
        }
      }
    }
  }

  // -------------------------------------------------------------- 2. produtos
  // Pre-fetch produtos existentes (somente codigo). Paginado: o PostgREST
  // devolve no máximo 1000 linhas por requisição — sem o loop, catálogos
  // grandes ficariam quase todos marcados como "não existe".
  const produtosExistentes = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("produtos")
      .select("codigo")
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    for (const p of data) produtosExistentes.add(p.codigo);
    if (data.length < 1000) break;
  }

  // Separa rows em "atualizar existentes" e "criar novos".
  type UpdatePayload = {
    codigo: string;
    preco: number;
    estoque: number;
    marca_id: string | null;
  };
  type InsertPayload = UpdatePayload & {
    slug: string;
    nome: string;
    descricao: string | null;
    categoria_id: string | null;
    peso_kg: number;
    ativo: boolean;
    destaque: boolean;
    imagens: unknown[];
  };

  const paraAtualizar: UpdatePayload[] = [];
  const paraInserir: InsertPayload[] = [];
  // Slug uniqueness dentro do batch novo (em caso de descrições idênticas).
  const slugsNovos = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 1;
    const r = rows[i];
    const marcaId = r.fabricante
      ? marcaPorNome.get(r.fabricante.toLowerCase().trim()) ?? null
      : null;

    const base: UpdatePayload = {
      codigo: r.codigo,
      preco: r.preco ?? 0,
      estoque: r.estoque ?? 0,
      marca_id: marcaId,
    };

    if (produtosExistentes.has(r.codigo)) {
      paraAtualizar.push(base);
    } else if (criarNovos) {
      const nome = r.descricao && r.descricao.length > 1 ? r.descricao : r.codigo;
      // Slug: nome+codigo garante unicidade.
      let slug = `${slugify(nome) || "produto"}-${r.codigo}`.slice(0, 100);
      if (slugsNovos.has(slug)) slug = `${slug}-${i}`;
      slugsNovos.add(slug);
      const cat = extractCategoria(nome);
      paraInserir.push({
        ...base,
        slug,
        nome,
        descricao: r.referencia ? `Ref.: ${r.referencia}` : null,
        categoria_id: cat ? catPorSlug.get(cat.slug) ?? null : null,
        peso_kg: 0,
        ativo: true,
        destaque: false,
        imagens: [],
      });
    } else {
      erros.push({
        linha,
        codigo: r.codigo,
        motivo: "produto não existe e 'criar novos' está desligado",
      });
    }
  }

  // ------------------------------------------------------ 3. batch upsert
  let atualizados = 0;
  let inseridos = 0;

  // Atualiza existentes em batches via upsert (codigo já existe → UPDATE).
  for (let i = 0; i < paraAtualizar.length; i += BATCH_SIZE) {
    const chunk = paraAtualizar.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from("produtos")
      .upsert(chunk, { onConflict: "codigo" });
    if (error) {
      erros.push({
        linha: i,
        motivo: `Batch update ${i}-${i + chunk.length}: ${error.message}`,
      });
    } else {
      atualizados += chunk.length;
    }
  }

  // Insere novos em batches.
  for (let i = 0; i < paraInserir.length; i += BATCH_SIZE) {
    const chunk = paraInserir.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from("produtos")
      .upsert(chunk, { onConflict: "codigo" });
    if (error) {
      erros.push({
        linha: i,
        motivo: `Batch insert ${i}-${i + chunk.length}: ${error.message}`,
      });
    } else {
      inseridos += chunk.length;
    }
  }

  // ---------------------------------------------- 4. agrupamento de variantes
  // Roda apenas para os produtos recém-inseridos. Evita mexer em produtos
  // existentes (preserva eventuais ajustes manuais do admin).
  let variantesLinkadas = 0;
  if (paraInserir.length >= 2) {
    const codigosNovos = paraInserir.map((p) => p.codigo);

    // Busca os IDs dos novos.
    const { data: novosProds } = await sb
      .from("produtos")
      .select("id, codigo")
      .in("codigo", codigosNovos);
    const idPorCodigo = new Map<string, string>(
      (novosProds ?? []).map((p) => [p.codigo, p.id]),
    );

    // Mapeia codigo → fabricante (das rows do PDF).
    const fabPorCodigo = new Map<string, string | null>();
    for (const r of rows) fabPorCodigo.set(r.codigo, r.fabricante);

    // Roda clustering apenas nos novos.
    const minProdutos = paraInserir.map((p) => ({
      codigo: p.codigo,
      descricao: p.nome,
      fabricante: fabPorCodigo.get(p.codigo) ?? null,
    }));
    const clusters = clusterVariantes(minProdutos);

    type LinkUpdate = {
      codigo: string;
      produto_pai_id: string | null;
      variante_label: string | null;
    };
    const linkUpdates: LinkUpdate[] = [];

    for (const cluster of clusters) {
      const pai = cluster.itens[0];
      const paiId = idPorCodigo.get(pai.codigo);
      if (!paiId) continue;

      // Pai: ganha rótulo da própria variante (ex: "025-30") mas sem produto_pai_id.
      linkUpdates.push({
        codigo: pai.codigo,
        produto_pai_id: null,
        variante_label: extractVarianteLabel(pai.descricao, cluster.prefixo) || null,
      });

      for (const filho of cluster.itens.slice(1)) {
        if (!idPorCodigo.has(filho.codigo)) continue;
        linkUpdates.push({
          codigo: filho.codigo,
          produto_pai_id: paiId,
          variante_label:
            extractVarianteLabel(filho.descricao, cluster.prefixo) || null,
        });
      }
    }

    // Aplica em batches.
    for (let i = 0; i < linkUpdates.length; i += BATCH_SIZE) {
      const chunk = linkUpdates.slice(i, i + BATCH_SIZE);
      const { error } = await sb
        .from("produtos")
        .upsert(chunk, { onConflict: "codigo" });
      if (error) {
        erros.push({
          linha: i,
          motivo: `Batch link variantes ${i}-${i + chunk.length}: ${error.message}`,
        });
      } else {
        variantesLinkadas += chunk.length;
      }
    }
  }

  await sb
    .from("imports")
    .update({
      status: "concluido",
      linhas_ok: atualizados + inseridos,
      linhas_erro: erros.length,
      detalhes: erros.slice(0, 500), // limita pra caber no jsonb
      concluido_em: new Date().toISOString(),
    })
    .eq("id", importId);

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/dashboard");

  return {
    ok: true,
    total: rows.length,
    atualizados,
    inseridos,
    variantes: variantesLinkadas,
    erros,
    importId,
  };
}

function normalizeKeys(r: Row): Row {
  const out: Row = {};
  for (const k of Object.keys(r)) {
    out[k.toLowerCase().trim()] = r[k];
  }
  return out;
}
