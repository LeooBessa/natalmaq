import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

import { formatBRL } from "@/lib/format";

// ── Tipos da view do PDF (montados na rota) ────────────────────────────────
export type PdfItem = {
  codigo: string;
  nome: string;
  quantidade: number;
  preco_unit: number;
  preco_total: number;
  // Imagem já baixada e validada (jpg/png) na rota; null = sem foto.
  imagem: { data: Buffer; format: "jpg" | "png" } | null;
};

export type PdfEndereco = {
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  complemento?: string | null;
} | null;

export type PdfPedido = {
  numero: number;
  status: string;
  criado_em: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  tipo_entrega: string | null;
  endereco: PdfEndereco;
  subtotal: number;
  desconto: number;
  frete_valor: number;
  total: number;
  observacoes: string | null;
};

const BRAND = "#FF6B00";
const NAVY = "#0A1628";
const INK = "#0F1F3D";
const MUTED = "#475569";
const LINE = "#D6D2C9";

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 12,
  },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  logo: { width: 116, height: 29, objectFit: "contain" },
  brandAccent: { color: BRAND },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 1 },
  headRight: { alignItems: "flex-end" },
  pedidoNum: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK },
  meta: { fontSize: 9, color: MUTED, marginTop: 3 },
  statusPill: {
    marginTop: 5,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    backgroundColor: BRAND,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    textTransform: "uppercase",
  },

  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 16,
  },
  row2: { flexDirection: "row" },
  colL: { flex: 1, marginRight: 12 },
  colR: { flex: 1 },
  box: { borderWidth: 1, borderColor: LINE, borderRadius: 3, padding: 10 },
  kv: { flexDirection: "row", marginBottom: 3 },
  k: { width: 64, color: MUTED },
  v: { flex: 1, fontFamily: "Helvetica-Bold" },
  addr: { lineHeight: 1.5 },

  th: {
    flexDirection: "row",
    backgroundColor: "#F4F2EE",
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EDEAE3",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cImg: { width: 44 },
  thumb: { width: 36, height: 36, objectFit: "contain", borderWidth: 1, borderColor: LINE, borderRadius: 2 },
  thumbPlaceholder: { width: 36, height: 36, borderWidth: 1, borderColor: LINE, borderRadius: 2, backgroundColor: "#F4F2EE" },
  cProd: { flex: 1, paddingRight: 6 },
  prodCodigo: { fontSize: 7, color: MUTED },
  prodNome: { fontSize: 9, color: INK },
  cQtd: { width: 34, textAlign: "center" },
  cUnit: { width: 64, textAlign: "right" },
  cTotal: { width: 70, textAlign: "right", fontFamily: "Helvetica-Bold" },

  totals: { marginTop: 12, alignItems: "flex-end" },
  totRow: { flexDirection: "row", width: 210, justifyContent: "space-between", paddingVertical: 2 },
  totLabel: { color: MUTED },
  totValue: { fontFamily: "Helvetica-Bold" },
  grandRow: {
    flexDirection: "row",
    width: 210,
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: NAVY,
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  grandValue: { fontFamily: "Helvetica-Bold", fontSize: 12, color: BRAND },

  obs: { marginTop: 4, fontSize: 9, color: INK, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
  },
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  confirmado: "Confirmado",
  enviado: "Enviado",
  recusado: "Recusado",
};

export function PedidoPdf({
  pedido,
  itens,
  logo,
}: {
  pedido: PdfPedido;
  itens: PdfItem[];
  logo?: { data: Buffer; format: "png" } | null;
}) {
  const num = String(pedido.numero).padStart(5, "0");
  const data = new Date(pedido.criado_em).toLocaleString("pt-BR");
  const e = pedido.endereco;
  const retirada = pedido.tipo_entrega === "retirada";

  return (
    <Document title={`Pedido ${num} - Natalmaq`}>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <View>
            {logo ? (
              <Image src={logo} style={s.logo} />
            ) : (
              <Text style={s.brand}>
                NATAL<Text style={s.brandAccent}>MAQ</Text>
              </Text>
            )}
            <Text style={s.brandSub}>Máquinas · Ferramentas · EPI</Text>
          </View>
          <View style={s.headRight}>
            <Text style={s.pedidoNum}>PEDIDO #{num}</Text>
            <Text style={s.meta}>{data}</Text>
            <Text style={s.statusPill}>{STATUS_LABEL[pedido.status] ?? pedido.status}</Text>
          </View>
        </View>

        {/* Cliente + Entrega */}
        <View style={s.row2}>
          <View style={s.colL}>
            <Text style={s.sectionTitle}>Cliente</Text>
            <View style={s.box}>
              <View style={s.kv}>
                <Text style={s.k}>Nome</Text>
                <Text style={s.v}>{pedido.cliente_nome}</Text>
              </View>
              <View style={s.kv}>
                <Text style={s.k}>Telefone</Text>
                <Text style={s.v}>{pedido.cliente_telefone}</Text>
              </View>
              {pedido.cliente_email ? (
                <View style={s.kv}>
                  <Text style={s.k}>E-mail</Text>
                  <Text style={s.v}>{pedido.cliente_email}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.colR}>
            <Text style={s.sectionTitle}>{retirada ? "Retirada" : "Entrega"}</Text>
            <View style={s.box}>
              {retirada ? (
                <Text style={s.addr}>
                  Retirada na loja{"\n"}
                  R. Pres. Sarmento, 545 — Alecrim{"\n"}
                  Natal/RN · CEP 59037-400
                </Text>
              ) : e ? (
                <Text style={s.addr}>
                  {e.rua}
                  {e.numero ? `, ${e.numero}` : ""}
                  {e.complemento ? ` (${e.complemento})` : ""}
                  {"\n"}
                  {e.bairro ? `${e.bairro} — ` : ""}
                  {e.cidade}/{e.uf}
                  {"\n"}
                  {e.cep ? `CEP ${e.cep}` : ""}
                </Text>
              ) : (
                <Text style={{ color: MUTED }}>—</Text>
              )}
            </View>
          </View>
        </View>

        {/* Itens */}
        <Text style={s.sectionTitle}>Itens ({itens.length})</Text>
        <View style={s.th}>
          <Text style={s.cImg}> </Text>
          <Text style={s.cProd}>Produto</Text>
          <Text style={s.cQtd}>Qtd</Text>
          <Text style={s.cUnit}>Unit.</Text>
          <Text style={s.cTotal}>Total</Text>
        </View>
        {itens.map((it, i) => (
          <View style={s.tr} key={i} wrap={false}>
            <View style={s.cImg}>
              {it.imagem ? (
                <Image style={s.thumb} src={it.imagem} />
              ) : (
                <View style={s.thumbPlaceholder} />
              )}
            </View>
            <View style={s.cProd}>
              <Text style={s.prodCodigo}>{it.codigo}</Text>
              <Text style={s.prodNome}>{it.nome}</Text>
            </View>
            <Text style={s.cQtd}>{it.quantidade}</Text>
            <Text style={s.cUnit}>{formatBRL(it.preco_unit)}</Text>
            <Text style={s.cTotal}>{formatBRL(it.preco_total)}</Text>
          </View>
        ))}

        {/* Totais */}
        <View style={s.totals}>
          <View style={s.totRow}>
            <Text style={s.totLabel}>Subtotal</Text>
            <Text style={s.totValue}>{formatBRL(pedido.subtotal)}</Text>
          </View>
          {pedido.desconto > 0 ? (
            <View style={s.totRow}>
              <Text style={s.totLabel}>Desconto</Text>
              <Text style={s.totValue}>-{formatBRL(pedido.desconto)}</Text>
            </View>
          ) : null}
          <View style={s.totRow}>
            <Text style={s.totLabel}>Frete</Text>
            <Text style={s.totValue}>{formatBRL(pedido.frete_valor)}</Text>
          </View>
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>TOTAL</Text>
            <Text style={s.grandValue}>{formatBRL(pedido.total)}</Text>
          </View>
        </View>

        {/* Observações */}
        {pedido.observacoes ? (
          <View>
            <Text style={s.sectionTitle}>Observações</Text>
            <Text style={s.obs}>{pedido.observacoes}</Text>
          </View>
        ) : null}

        {/* Rodapé fixo */}
        <Text style={s.footer} fixed>
          Natalmaq · (84) 3025-9789 · vendas@natalmaq.com.br · natalmaq.com.br
        </Text>
      </Page>
    </Document>
  );
}
