"use client";

import { useMemo, useState, useTransition } from "react";

import { aplicarFotosSelecionadasAction } from "./actions";

type ImagemMeta = {
  url: string;
  w: number;
  h: number;
  tipo: string;
  score: number;
};
type ProdutoPdf = {
  page: number;
  tipo: string;
  modelo: string;
  modelo_variante: string | null;
  codigos_pedido: string[];
  tagline: string;
  bullets: string[];
  descricao: string;
  imagens_candidatas_hashes: string[];
};
type ProdutoBanco = {
  id: string;
  codigo: string;
  nome: string;
  slug: string;
  descricao: string | null;
  imagens: string[];
};

type Props = {
  importId: string;
  produtosPdf: ProdutoPdf[];
  imagens: Record<string, ImagemMeta>;
  produtosBanco: ProdutoBanco[];
};

type Selecao = {
  produto_id: string | null;
  imagem_hash: string | null;
  aplicar_descricao: boolean;
};

/**
 * Para cada produto detectado no PDF (linha):
 *   - sugere produto do banco com fuzzy match no nome (ILIKE %modelo%)
 *   - mostra grid de imagens candidatas (admin clica pra escolher a principal)
 *   - admin marca "aplicar descrição" se quiser substituir a descrição existente
 *   - botão "Aplicar selecionados" no rodapé envia tudo em batch
 */
export function ReviewBoard({
  importId,
  produtosPdf,
  imagens,
  produtosBanco,
}: Props) {
  const [busca, setBusca] = useState("");
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{
    aplicados: number;
    erros: { modelo: string; motivo: string }[];
  } | null>(null);

  // Estado da seleção: { [pdfIndex]: { produto_id, imagem_hash, aplicar_descricao } }
  const [selecoes, setSelecoes] = useState<Record<number, Selecao>>(() => {
    const init: Record<number, Selecao> = {};
    produtosPdf.forEach((prod, idx) => {
      const matched = autoMatch(prod, produtosBanco);
      init[idx] = {
        produto_id: matched?.id ?? null,
        imagem_hash:
          prod.imagens_candidatas_hashes.find((h) => imagens[h]) ?? null,
        aplicar_descricao: !matched?.descricao || matched.descricao.length < 20,
      };
    });
    return init;
  });

  const filtrados = useMemo(() => {
    if (!busca.trim()) return produtosPdf.map((p, i) => ({ p, i }));
    const q = busca.toLowerCase();
    return produtosPdf
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          p.modelo.toLowerCase().includes(q) ||
          p.tipo.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q),
      );
  }, [produtosPdf, busca]);

  const totalSelecionados = Object.values(selecoes).filter(
    (s) => s.produto_id && s.imagem_hash,
  ).length;

  function aplicar() {
    const itens = Object.entries(selecoes)
      .filter(([, s]) => s.produto_id && s.imagem_hash)
      .map(([idx, s]) => {
        const prod = produtosPdf[Number(idx)];
        return {
          produto_id: s.produto_id!,
          imagem_url: imagens[s.imagem_hash!]?.url,
          descricao: s.aplicar_descricao ? prod.descricao : null,
        };
      });

    if (itens.length === 0) return;
    startTransition(async () => {
      const res = await aplicarFotosSelecionadasAction(importId, itens);
      setResultado(res);
    });
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por modelo, tipo, tagline..."
          className="w-72 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <div className="text-sm text-zinc-600">
          <strong>{totalSelecionados}</strong> de {produtosPdf.length} prontos para
          aplicar
        </div>
        <button
          onClick={aplicar}
          disabled={pending || totalSelecionados === 0}
          className="ml-auto rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending
            ? "Aplicando..."
            : `Aplicar ${totalSelecionados} produto${totalSelecionados !== 1 ? "s" : ""}`}
        </button>
      </div>

      {resultado && (
        <div
          className={`rounded-md p-4 text-sm ${resultado.erros.length === 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}
        >
          <p className="font-semibold">
            {resultado.aplicados} produto{resultado.aplicados !== 1 ? "s" : ""}{" "}
            atualizado
            {resultado.aplicados !== 1 ? "s" : ""}.
          </p>
          {resultado.erros.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">
                {resultado.erros.length} erro
                {resultado.erros.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 space-y-1">
                {resultado.erros.map((e, i) => (
                  <li key={i} className="font-mono text-xs">
                    {e.modelo}: {e.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="space-y-4">
        {filtrados.map(({ p, i }) => (
          <ProdutoRow
            key={i}
            idx={i}
            prod={p}
            imagens={imagens}
            produtosBanco={produtosBanco}
            sel={selecoes[i]}
            setSel={(s) =>
              setSelecoes((prev) => ({ ...prev, [i]: s }))
            }
          />
        ))}
      </div>
    </>
  );
}

function ProdutoRow({
  idx,
  prod,
  imagens,
  produtosBanco,
  sel,
  setSel,
}: {
  idx: number;
  prod: ProdutoPdf;
  imagens: Record<string, ImagemMeta>;
  produtosBanco: ProdutoBanco[];
  sel: Selecao;
  setSel: (s: Selecao) => void;
}) {
  const candidatos = prod.imagens_candidatas_hashes
    .map((h) => ({ hash: h, ...imagens[h] }))
    .filter((c) => c.url);

  const matchSugerido = useMemo(
    () => autoMatch(prod, produtosBanco),
    [prod, produtosBanco],
  );

  const produtoSelecionado = sel.produto_id
    ? produtosBanco.find((p) => p.id === sel.produto_id)
    : null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-[1.2fr_2fr]">
        {/* Esquerda: dados do PDF */}
        <div>
          <div className="text-xs font-mono uppercase tracking-wide text-zinc-500">
            pág {prod.page} · {prod.tipo}
          </div>
          <div className="mt-1 text-base font-bold text-zinc-900">
            {prod.modelo}
            {prod.modelo_variante && (
              <span className="ml-2 font-mono text-xs text-zinc-500">
                {prod.modelo_variante}
              </span>
            )}
          </div>
          {prod.tagline && (
            <p className="mt-1 text-sm text-zinc-700">{prod.tagline}</p>
          )}
          {prod.bullets.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-zinc-600">
              {prod.bullets.slice(0, 4).map((b, i) => (
                <li key={i} className="line-clamp-2">
                  • {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Direita: produto do banco + foto */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-zinc-700">
              Produto na loja
            </label>
            <ProdutoSelector
              produtos={produtosBanco}
              value={sel.produto_id}
              onChange={(id) => setSel({ ...sel, produto_id: id })}
              sugerido={matchSugerido?.id ?? null}
            />
            {produtoSelecionado && (
              <div className="mt-1 text-xs text-zinc-500">
                <span className="font-mono">{produtoSelecionado.codigo}</span> ·{" "}
                {produtoSelecionado.nome}
                {produtoSelecionado.imagens.length > 0 && (
                  <span className="ml-2 text-amber-600">
                    (já tem {produtoSelecionado.imagens.length} foto
                    {produtoSelecionado.imagens.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700">
              Foto a aplicar
            </label>
            {candidatos.length === 0 ? (
              <div className="mt-1 rounded border border-dashed border-zinc-300 p-3 text-xs text-zinc-500">
                Nenhuma foto de produto encontrada para essa página.
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {candidatos.map((c) => (
                  <button
                    key={c.hash}
                    type="button"
                    onClick={() => setSel({ ...sel, imagem_hash: c.hash })}
                    className={`relative rounded border-2 transition ${
                      sel.imagem_hash === c.hash
                        ? "border-brand-600 ring-2 ring-brand-200"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                    title={`${c.w}×${c.h} · ${c.tipo} · score ${c.score}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.url}
                      alt=""
                      className="h-20 w-20 object-contain"
                    />
                    <span className="absolute bottom-0 right-0 bg-zinc-900/60 px-1 text-[9px] text-white">
                      {c.tipo[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={sel.aplicar_descricao}
              onChange={(e) =>
                setSel({ ...sel, aplicar_descricao: e.target.checked })
              }
            />
            Aplicar também a descrição do PDF (substitui a atual)
          </label>
        </div>
      </div>
    </div>
  );
}

function ProdutoSelector({
  produtos,
  value,
  onChange,
  sugerido,
}: {
  produtos: ProdutoBanco[];
  value: string | null;
  onChange: (id: string | null) => void;
  sugerido: string | null;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`mt-1 w-full rounded-md border px-3 py-1.5 text-sm ${value === sugerido && sugerido ? "border-brand-400 bg-brand-50" : "border-zinc-300 bg-white"}`}
    >
      <option value="">— pular este produto —</option>
      {produtos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.codigo} · {p.nome}
          {p.id === sugerido ? "  ← sugerido" : ""}
        </option>
      ))}
    </select>
  );
}

// ─── Auto-match ───────────────────────────────────────────────
function autoMatch(prod: ProdutoPdf, banco: ProdutoBanco[]): ProdutoBanco | null {
  if (banco.length === 0) return null;
  const modelo = prod.modelo.toLowerCase().replace(/\s+/g, " ").trim();
  if (!modelo) return null;

  // 1) Match exato no nome (pequena variação de espaço)
  const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
  const modeloNorm = norm(modelo);
  const exato = banco.find((p) => norm(p.nome).includes(modeloNorm));
  if (exato) return exato;

  // 2) Match por modelo curto (primeiro segmento, ex: "GSR" ou "GSR 185-LI" → "GSR 185-LI")
  for (const p of banco) {
    if (p.nome.toLowerCase().includes(modelo)) return p;
  }

  // 3) Match por código de pedido completo (último recurso)
  for (const cod of prod.codigos_pedido) {
    const codNorm = norm(cod);
    const m = banco.find((p) => norm(p.codigo) === codNorm);
    if (m) return m;
  }

  return null;
}
