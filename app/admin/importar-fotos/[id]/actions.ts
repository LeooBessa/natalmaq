"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PRODUTOS_BUCKET = "produtos";

export type AplicarItem = {
  produto_id: string;
  imagem_url: string;
  descricao: string | null;
};

export type AplicarResult = {
  aplicados: number;
  erros: { modelo: string; motivo: string }[];
};

/**
 * Para cada item:
 *  1. Baixa a imagem do bucket fotos-import (signed URL pública)
 *  2. Faz upload para o bucket produtos/{produto_id}/{hash}.png
 *  3. UPDATE produtos SET imagens = [novaUrl, ...] (prepend), descricao = ?
 */
export async function aplicarFotosSelecionadasAction(
  importId: string,
  itens: AplicarItem[],
): Promise<AplicarResult> {
  const sb = await createSupabaseServerClient();
  const erros: AplicarResult["erros"] = [];
  let aplicados = 0;

  for (const item of itens) {
    try {
      // 1) Baixa imagem do bucket público
      const res = await fetch(item.imagem_url);
      if (!res.ok) {
        erros.push({
          modelo: item.produto_id,
          motivo: `download HTTP ${res.status}`,
        });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());

      // 2) Sobe pro bucket produtos
      const fname = item.imagem_url.split("/").pop() ?? `${Date.now()}.png`;
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
