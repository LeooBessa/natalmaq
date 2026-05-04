"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PRODUTOS_BUCKET = "produtos";

export type AplicarItem = {
  produto_id: string;
  imagem_hash: string;
  descricao: string | null;
};

export type AplicarResult = {
  aplicados: number;
  erros: { modelo: string; motivo: string }[];
};

/**
 * Para cada item:
 *  1. Resolve o path da imagem a partir do import (bucket privado)
 *  2. Baixa via SDK do bucket fotos-import
 *  3. Faz upload para o bucket produtos/{produto_id}/{hash}.png
 *  4. UPDATE produtos SET imagens = [novaUrl, ...] (prepend), descricao = ?
 */
export async function aplicarFotosSelecionadasAction(
  importId: string,
  itens: AplicarItem[],
): Promise<AplicarResult> {
  const sb = await createSupabaseServerClient();
  const erros: AplicarResult["erros"] = [];
  let aplicados = 0;

  // Carrega dados do import para resolver hash → path
  const { data: imp } = await sb
    .from("imports_fotos")
    .select("dados")
    .eq("id", importId)
    .maybeSingle();
  const imagensDados: Record<string, { path?: string; url?: string }> =
    (imp?.dados as { imagens?: Record<string, { path?: string; url?: string }> })
      ?.imagens ?? {};

  for (const item of itens) {
    try {
      const imgMeta = imagensDados[item.imagem_hash];
      const imgPath =
        imgMeta?.path ??
        imgMeta?.url?.split("/object/public/fotos-import/")?.[1];
      if (!imgPath) {
        erros.push({ modelo: item.produto_id, motivo: "imagem não encontrada no import" });
        continue;
      }

      // 1) Baixa do bucket privado via SDK (sem depender de URL pública)
      const { data: imgData, error: errDl } = await sb.storage
        .from("fotos-import")
        .download(imgPath);
      if (errDl || !imgData) {
        erros.push({ modelo: item.produto_id, motivo: errDl?.message ?? "download falhou" });
        continue;
      }
      const buf = Buffer.from(await imgData.arrayBuffer());

      // 2) Sobe pro bucket produtos
      const fname = `${item.imagem_hash}.png`;
      const path = `${item.produto_id}/${Date.now()}-${fname}`;
      const { error: errUp } = await sb.storage
        .from(PRODUTOS_BUCKET)
        .upload(path, buf, {
          contentType: "image/png",
          upsert: false,
        });
      if (errUp) {
        erros.push({ modelo: item.produto_id, motivo: errUp.message });
        continue;
      }
      const { data: pub } = sb.storage
        .from(PRODUTOS_BUCKET)
        .getPublicUrl(path);

      // 3) UPDATE produto: prepend a nova imagem (vira a principal)
      const { data: prod, error: errSel } = await sb
        .from("produtos")
        .select("imagens, descricao")
        .eq("id", item.produto_id)
        .maybeSingle();
      if (errSel || !prod) {
        erros.push({
          modelo: item.produto_id,
          motivo: errSel?.message ?? "produto não encontrado",
        });
        continue;
      }

      const novasImagens = [
        pub.publicUrl,
        ...(Array.isArray(prod.imagens) ? prod.imagens : []),
      ];
      const update: Record<string, unknown> = { imagens: novasImagens };
      if (item.descricao && item.descricao.trim().length > 10) {
        update.descricao = item.descricao;
      }

      const { error: errUp2 } = await sb
        .from("produtos")
        .update(update)
        .eq("id", item.produto_id);

      if (errUp2) {
        erros.push({ modelo: item.produto_id, motivo: errUp2.message });
        continue;
      }
      aplicados++;
    } catch (e) {
      erros.push({
        modelo: item.produto_id,
        motivo: (e as Error).message,
      });
    }
  }

  if (aplicados > 0) {
    await sb
      .from("imports_fotos")
      .update({
        status: "aplicado",
        aplicado_em: new Date().toISOString(),
      })
      .eq("id", importId);
  }

  revalidatePath("/admin/importar-fotos");
  revalidatePath(`/admin/importar-fotos/${importId}`);
  revalidatePath("/admin/produtos");
  return { aplicados, erros };
}
