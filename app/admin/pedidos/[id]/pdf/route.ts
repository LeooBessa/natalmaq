import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PedidoPdf, type PdfItem } from "./PedidoPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Baixa a imagem e só aceita JPEG/PNG (formatos que o @react-pdf decodifica).
 * WebP/AVIF ou erro → null (vira placeholder no PDF, sem quebrar a geração).
 */
async function fetchImagem(
  url: string | null | undefined,
): Promise<PdfItem["imagem"]> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf[0] === 0xff && buf[1] === 0xd8) return { data: buf, format: "jpg" };
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
      return { data: buf, format: "png" };
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();

  // Autorização: precisa ser admin ativo (espelha o gate do /admin).
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });
  const { data: admin } = await sb
    .from("admins")
    .select("ativo")
    .eq("id", user.id)
    .maybeSingle();
  if (!admin || !admin.ativo) return new Response("Acesso negado", { status: 403 });

  const { data: pedido } = await sb
    .from("pedidos")
    .select(
      "numero, status, cliente_nome, cliente_telefone, cliente_email, endereco, subtotal, desconto, frete_valor, total, observacoes, criado_em, tipo_entrega",
    )
    .eq("id", id)
    .maybeSingle();
  if (!pedido) return new Response("Pedido não encontrado", { status: 404 });

  const { data: itensRaw } = await sb
    .from("pedido_itens")
    .select(
      "codigo, nome_snapshot, quantidade, preco_unit, preco_total, produto:produtos(imagens)",
    )
    .eq("pedido_id", id);

  const itens: PdfItem[] = await Promise.all(
    (itensRaw ?? []).map(async (i) => {
      // PostgREST tipa o embed como array mesmo sendo to-one; normaliza.
      const raw = i.produto as unknown;
      const produto = (Array.isArray(raw) ? raw[0] : raw) as
        | { imagens: string[] | null }
        | null
        | undefined;
      return {
        codigo: i.codigo,
        nome: i.nome_snapshot,
        quantidade: i.quantidade,
        preco_unit: Number(i.preco_unit),
        preco_total: Number(i.preco_total),
        imagem: await fetchImagem(produto?.imagens?.[0]),
      };
    }),
  );

  // Logo (lockup) no topo do PDF; se faltar o arquivo, cai no wordmark de texto.
  let logo: { data: Buffer; format: "png" } | null = null;
  try {
    const data = await readFile(
      path.join(process.cwd(), "public/brand/natalmaq-lockup.png"),
    );
    logo = { data, format: "png" };
  } catch {
    logo = null;
  }

  const elemento = createElement(PedidoPdf, {
    pedido: {
      numero: pedido.numero,
      status: pedido.status,
      criado_em: pedido.criado_em,
      cliente_nome: pedido.cliente_nome,
      cliente_telefone: pedido.cliente_telefone,
      cliente_email: pedido.cliente_email,
      tipo_entrega: pedido.tipo_entrega,
      endereco: pedido.endereco,
      subtotal: Number(pedido.subtotal),
      desconto: Number(pedido.desconto ?? 0),
      frete_valor: Number(pedido.frete_valor),
      total: Number(pedido.total),
      observacoes: pedido.observacoes,
    },
    itens,
    logo,
  }) as Parameters<typeof renderToBuffer>[0];

  const buffer = await renderToBuffer(elemento);
  const num = String(pedido.numero).padStart(5, "0");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pedido-${num}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
