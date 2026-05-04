"use server";

import { revalidatePath } from "next/cache";

import { extractSupplierCatalog } from "@/lib/supplier-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "fotos-import";

// ─────────────────────────────────────────────────────────────
// 1) Cria registro e retorna o path onde o browser deve subir o PDF
// ─────────────────────────────────────────────────────────────
export type CriarResult =
  | { ok: true; id: string; upload_path: string }
  | { ok: false; error: string };

export async function criarImportFotosAction(input: {
  marca_id: string;
  arquivo_pdf: string;
}): Promise<CriarResult> {
  if (!input.marca_id) return { ok: false, error: "Selecione a marca" };
  if (!input.arquivo_pdf) return { ok: false, error: "PDF inválido" };

  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from("imports_fotos")
    .insert({
      marca_id: input.marca_id,
      arquivo_pdf: input.arquivo_pdf,
      status: "processando",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const upload_path = `${data.id}/raw.pdf`;
  return { ok: true, id: data.id as string, upload_path };
}

// ─────────────────────────────────────────────────────────────
// 2) Baixa o PDF do Storage, processa, sobe imagens, salva dados
// ─────────────────────────────────────────────────────────────
export type ProcessarResult = { ok: true } | { ok: false; error: string };

export async function processarImportFotosAction(
  importId: string,
): Promise<ProcessarResult> {
  const sb = await createSupabaseServerClient();

  // Confirma que o registro existe e baixa o PDF
  const { data: imp, error: errSel } = await sb
    .from("imports_fotos")
    .select("id, arquivo_pdf, status")
    .eq("id", importId)
    .maybeSingle();
  if (errSel || !imp) return { ok: false, error: "Importação não encontrada" };

  const pdfPath = `${importId}/raw.pdf`;
  const { data: pdfData, error: errDl } = await sb.storage
    .from(BUCKET)
    .download(pdfPath);
  if (errDl) return { ok: false, error: "Falha ao baixar PDF: " + errDl.message };

  let catalogo;
  try {
    const buf = Buffer.from(await pdfData.arrayBuffer());
    catalogo = await extractSupplierCatalog(buf);
  } catch (e) {
    await sb
      .from("imports_fotos")
      .update({ status: "cancelado" })
      .eq("id", importId);
    return {
      ok: false,
      error: "Falha ao processar PDF: " + (e as Error).message,
    };
  }

  // Sobe imagens classificadas como produto/lifestyle
  const imagensUteis = [...catalogo.imagens.values()].filter(
    (img) => img.tipo === "produto" || img.tipo === "lifestyle",
  );

  const imagensMeta: Record<
    string,
    {
      path: string;
      w: number;
      h: number;
      tipo: string;
      score: number;
    }
  > = {};

  const CHUNK = 10;
  for (let i = 0; i < imagensUteis.length; i += CHUNK) {
    const chunk = imagensUteis.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (img) => {
        const path = `${importId}/imgs/${img.hash}.png`;
        const { error: errUp } = await sb.storage
          .from(BUCKET)
          .upload(path, img.png, {
            contentType: "image/png",
            upsert: true,
          });
        if (errUp) return;
        imagensMeta[img.hash] = {
          path,
          w: img.w,
          h: img.h,
          tipo: img.tipo,
          score: img.score,
        };
      }),
    );
  }

  const dados = {
    produtos: catalogo.produtos.map((p) => ({
      ...p,
      imagens_candidatas_hashes: p.imagens_candidatas_hashes.filter(
        (h) => imagensMeta[h],
      ),
    })),
    imagens: imagensMeta,
  };

  const { error: errUp2 } = await sb
    .from("imports_fotos")
    .update({
      status: "aguardando_review",
      total_paginas: catalogo.total_paginas,
      total_produtos: catalogo.produtos.length,
      total_imagens: Object.keys(imagensMeta).length,
      dados,
      processado_em: new Date().toISOString(),
    })
    .eq("id", importId);
  if (errUp2) return { ok: false, error: errUp2.message };

  revalidatePath("/admin/importar-fotos");
  revalidatePath(`/admin/importar-fotos/${importId}`);
  return { ok: true };
}
