from __future__ import annotations

import os
from urllib.parse import quote

from fastapi import APIRouter, HTTPException

from ..core.schemas import PedidoCriado, PedidoIn
from ..core.settings import get_settings
from ..core.supabase import get_supabase

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])


def _format_brl(v: float) -> str:
    s = f"R$ {v:,.2f}"
    # converte 1,234.56 → 1.234,56
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _build_message(pedido_numero: int, cliente_nome: str, cliente_telefone: str,
                   endereco: dict, itens_detalhados: list[dict],
                   subtotal: float, desconto_valor: float, cupom_codigo: str | None,
                   frete_valor: float, total: float,
                   observacoes: str | None) -> str:
    settings = get_settings()
    lines: list[str] = []
    lines.append(f"*ORÇAMENTO #{str(pedido_numero).zfill(5)}* — {settings.loja_nome}")
    lines.append("")
    lines.append(f"*Cliente:* {cliente_nome}")
    lines.append(f"*Telefone:* {cliente_telefone}")
    if endereco:
        rua = ", ".join([p for p in [endereco.get("rua"), endereco.get("numero")] if p])
        l2 = " — ".join(
            [p for p in [endereco.get("bairro"), f"{endereco.get('cidade','')}/{endereco.get('uf','')}", endereco.get("cep")] if p]
        )
        lines.append(f"*Endereço:* {rua}")
        if l2:
            lines.append(f"           {l2}")
    lines.append("")
    lines.append("*ITENS:*")
    for i in itens_detalhados:
        total_item = i["preco_unit"] * i["quantidade"]
        lines.append(
            f"• {i['quantidade']}x {i['nome_snapshot']} ({i['codigo']}) — {_format_brl(total_item)}"
        )
    lines.append("")
    lines.append(f"Subtotal: {_format_brl(subtotal)}")
    if desconto_valor > 0:
        label = f"Cupom ({cupom_codigo})" if cupom_codigo else "Desconto"
        lines.append(f"{label}: -{_format_brl(desconto_valor)}")
    lines.append(f"Frete:    {_format_brl(frete_valor)}")
    lines.append(f"*TOTAL:   {_format_brl(total)}*")
    if observacoes:
        lines.append("")
        lines.append(f"_Observações:_ {observacoes}")
    return "\n".join(lines)


@router.post("", response_model=PedidoCriado)
async def criar_pedido(payload: PedidoIn) -> PedidoCriado:
    sb = get_supabase()
    settings = get_settings()

    # 1) Carrega produtos confiáveis (preço/estoque/snapshot vem do servidor)
    ids = [i.produto_id for i in payload.itens]
    res = (
        sb.table("produtos")
        .select("id, codigo, nome, preco, preco_promocional, estoque, ativo")
        .in_("id", ids)
        .execute()
    )
    produtos_map = {p["id"]: p for p in (res.data or [])}

    if len(produtos_map) != len(ids):
        raise HTTPException(status_code=400, detail="Item inexistente no carrinho")

    itens_detalhados: list[dict] = []
    subtotal = 0.0
    for it in payload.itens:
        p = produtos_map[it.produto_id]
        if not p["ativo"]:
            raise HTTPException(status_code=400, detail=f"Produto inativo: {p['nome']}")
        if it.quantidade > int(p["estoque"]):
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente para {p['nome']} (disp.: {p['estoque']})",
            )
        preco_unit = float(p["preco_promocional"] or p["preco"])
        preco_total = round(preco_unit * it.quantidade, 2)
        subtotal += preco_total
        itens_detalhados.append({
            "produto_id": p["id"],
            "codigo": p["codigo"],
            "nome_snapshot": p["nome"],
            "quantidade": it.quantidade,
            "preco_unit": preco_unit,
            "preco_total": preco_total,
        })

    subtotal = round(subtotal, 2)

    # Valida e aplica cupom (autoridade no servidor)
    desconto_valor = 0.0
    cupom_codigo_validado: str | None = None
    if payload.cupom_codigo:
        res = (
            sb.table("cupons")
            .select("codigo, tipo, valor, valor_minimo, usos_max, usos_atual, validade")
            .eq("codigo", payload.cupom_codigo.upper().strip())
            .eq("ativo", True)
            .maybe_single()
            .execute()
        )
        c = res.data
        from datetime import datetime, timezone
        if c and (not c["validade"] or datetime.fromisoformat(c["validade"]) > datetime.now(timezone.utc)):
            if c["usos_max"] is None or c["usos_atual"] < c["usos_max"]:
                if subtotal >= float(c["valor_minimo"]):
                    if c["tipo"] == "percentual":
                        desconto_valor = round(subtotal * float(c["valor"]) / 100, 2)
                    else:
                        desconto_valor = min(float(c["valor"]), subtotal)
                    cupom_codigo_validado = c["codigo"]

    total = round(subtotal - desconto_valor + payload.frete_valor, 2)

    # 2) Cria o pedido
    novo = (
        sb.table("pedidos")
        .insert({
            "cliente_nome": payload.cliente_nome,
            "cliente_telefone": payload.cliente_telefone,
            "cliente_email": payload.cliente_email,
            "endereco": payload.endereco.model_dump(),
            "subtotal": subtotal,
            "frete_valor": payload.frete_valor,
            "desconto_valor": desconto_valor,
            "cupom_codigo": cupom_codigo_validado,
            "total": total,
            "observacoes": payload.observacoes,
        })
        .execute()
    )
    pedido = novo.data[0]
    pedido_id = pedido["id"]
    pedido_numero = int(pedido["numero"])

    # 3) Cria itens
    sb.table("pedido_itens").insert([
        {**i, "pedido_id": pedido_id} for i in itens_detalhados
    ]).execute()

    # 3b) Incrementa usos do cupom
    if cupom_codigo_validado and c:
        sb.table("cupons").update({"usos_atual": int(c["usos_atual"]) + 1}).eq(
            "codigo", cupom_codigo_validado
        ).execute()

    # 4) Monta mensagem WhatsApp
    msg = _build_message(
        pedido_numero=pedido_numero,
        cliente_nome=payload.cliente_nome,
        cliente_telefone=payload.cliente_telefone,
        endereco=payload.endereco.model_dump(),
        itens_detalhados=itens_detalhados,
        subtotal=subtotal,
        desconto_valor=desconto_valor,
        cupom_codigo=cupom_codigo_validado,
        frete_valor=payload.frete_valor,
        total=total,
        observacoes=payload.observacoes,
    )
    numero_loja = "".join(c for c in settings.loja_whatsapp if c.isdigit())
    whatsapp_url = f"https://wa.me/{numero_loja}?text={quote(msg)}"

    # 5) Persiste link
    sb.table("pedidos").update({"whatsapp_url": whatsapp_url}).eq("id", pedido_id).execute()

    return PedidoCriado(
        id=pedido_id,
        numero=pedido_numero,
        whatsapp_url=whatsapp_url,
        total=total,
    )
