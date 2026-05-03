"use server";

import { revalidatePath } from "next/cache";

import { extractSupplierCatalog } from "@/lib/supplier-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProcessarResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const BUCKET = "fotos-import";

export async function processarPdfFornecedorAction(
  formData: FormData,
): Promise<ProcessarResult> {
  const file = formData.get("file");
  const marcaId = formData.get("marca_id");
  if (!(file instanceof File)) return { ok: false, error: "PDF inválido" };
  if (typeof marcaId !== "string" || !marcaId)
    return { ok: false, error: "Selecione a marca" };

  const sb = await createSupabaseServerClient();

  // 1) Cria registro
  const { data: importRec, error: errIns } = await sb
    .from("imports_fotos")
    .insert({
      marca_id: marcaId,
      arquivo_pdf: file.name,
      status: "processando",
    })
    .select("id")
    .single();
  if (errIns) return { ok: false, error: errIns.message };
  const importId = importRec.id as string;

  // 2) Processa PDF
  let catalogo;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    catalogo = await extractSupplierCatalog(buf);
  } catch (e) {
    await sb
      .from("imports_fotos")
      .update({ status: "cancelado" })
      .eq("id", importId);
    return { ok: false, error: "Falha ao processar PDF: " + (e as Error).message };
  }

  // 3) Sobe imagens (só produto + lifestyle — descarta máscara/decorativo)
  const imagensUteis = [...catalogo.imagens.values()].filter(
    (img) => img.tipo === "produto" || img.tipo === "lifestyle",
  );

  const imagensMeta: Record<
    string,
    {
      url: string;
      w: number;
      h: number;
      tipo: string;
      score: number;
    }
  > = {};

  // upload em paralelo (chunks de 10)
  const CHUNK = 10;
  for (let i = 0; i < imagensUteis.length; i += CHUNK) {
    const chunk = imagensUteis.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (img) => {
        const path = `${importId}/${img.hash}.png`;
        const { error: errUp } = await sb.storage
          .from(BUCKET)
          .upload(path, img.png, {
            contentType: "image/png",
            upsert: true,
          });
        if (errUp) return;
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
        imagensMeta[img.hash] = {
          url: pub.publicUrl,
          w: img.w,
          h: img.h,
          tipo: img.tipo,
          score: img.score,
        };
      }),
    );
  }

  // 4) Marca como aguardando_review com payload
  const dados = {
    produtos: catalogo.produtos.map((p) => ({
      ...p,
      // filtra os que sobreviveram ao upload
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
  return { ok: true, id: importId };
}
