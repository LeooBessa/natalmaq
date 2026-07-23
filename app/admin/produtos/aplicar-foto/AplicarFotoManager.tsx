"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, X, ImagePlus, Check } from "lucide-react";

import { uploadDireto } from "@/lib/supabase/upload-client";
import {
  aplicarImagemEmLoteAction,
  buscarProdutosParaFotoAction,
  type ProdutoBusca,
} from "./actions";

type Selecionado = { codigo: string; nome: string };

export function AplicarFotoManager() {
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fonte "usar foto de um produto existente"
  const [fonteAberta, setFonteAberta] = useState(false);
  const [qFonte, setQFonte] = useState("");
  const [fonteResultados, setFonteResultados] = useState<ProdutoBusca[]>([]);
  const [fonteBuscou, setFonteBuscou] = useState(false);
  const [buscandoFonte, startBuscaFonte] = useTransition();

  // Busca dos produtos-alvo
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [buscando, startBusca] = useTransition();

  const [selecionados, setSelecionados] = useState<Record<string, Selecionado>>({});
  const [aplicando, startAplicar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const idsSelecionados = Object.keys(selecionados);
  const visiveis = soSemFoto
    ? resultados.filter((p) => p.imagens.length === 0)
    : resultados;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    setMsg(null);
    const r = await uploadDireto("produtos", file);
    setUploading(false);
    if (r.error || !r.url) setUploadError(r.error ?? "Falha no upload.");
    else setImagemUrl(r.url);
  }

  function buscarFonte(e: React.FormEvent) {
    e.preventDefault();
    startBuscaFonte(async () => {
      const r = await buscarProdutosParaFotoAction(qFonte);
      setFonteResultados(r.filter((p) => p.imagens.length > 0));
      setFonteBuscou(true);
    });
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startBusca(async () => {
      const r = await buscarProdutosParaFotoAction(q);
      setResultados(r);
      setBuscou(true);
    });
  }

  function toggle(p: ProdutoBusca) {
    setSelecionados((s) => {
      const novo = { ...s };
      if (novo[p.id]) delete novo[p.id];
      else novo[p.id] = { codigo: p.codigo, nome: p.nome };
      return novo;
    });
  }

  function selecionarVisiveis() {
    setSelecionados((s) => {
      const novo = { ...s };
      for (const p of visiveis) novo[p.id] = { codigo: p.codigo, nome: p.nome };
      return novo;
    });
  }

  function aplicar() {
    if (!imagemUrl || idsSelecionados.length === 0) return;
    setMsg(null);
    startAplicar(async () => {
      const r = await aplicarImagemEmLoteAction(imagemUrl, idsSelecionados);
      if (r.error) {
        setMsg({ ok: false, texto: r.error });
      } else {
        setMsg({
          ok: true,
          texto: `Foto aplicada em ${r.count} produto${r.count === 1 ? "" : "s"}. ✓`,
        });
        setSelecionados({});
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Coluna esquerda: foto + selecionados + aplicar */}
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">1. Escolha a foto</h2>
          {imagemUrl ? (
            <div className="space-y-2">
              <div className="relative mx-auto h-40 w-40 overflow-hidden rounded border border-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagemUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <button
                onClick={() => setImagemUrl(null)}
                className="w-full rounded-md border border-zinc-300 py-1.5 text-sm font-medium hover:bg-zinc-50"
              >
                Trocar foto
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 hover:bg-zinc-50">
                <ImagePlus className="h-6 w-6" />
                {uploading ? "Enviando..." : "Enviar uma foto do computador"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="h-px flex-1 bg-zinc-200" /> ou <span className="h-px flex-1 bg-zinc-200" />
              </div>

              {!fonteAberta ? (
                <button
                  onClick={() => setFonteAberta(true)}
                  className="w-full rounded-md border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Usar uma foto que já está em um produto
                </button>
              ) : (
                <div className="space-y-2 rounded-md border border-zinc-200 p-2">
                  <form onSubmit={buscarFonte} className="flex gap-1.5">
                    <input
                      value={qFonte}
                      onChange={(e) => setQFonte(e.target.value)}
                      placeholder="Buscar produto que tem a foto..."
                      className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                    />
                    <button type="submit" disabled={buscandoFonte} className="rounded bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-50">
                      {buscandoFonte ? "..." : "Ir"}
                    </button>
                  </form>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {fonteResultados.map((p) => (
                      <div key={p.id}>
                        <p className="truncate text-xs text-zinc-500">
                          <span className="font-mono text-zinc-400">{p.codigo}</span> {p.nome}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {p.imagens.map((url) => (
                            <button
                              key={url}
                              onClick={() => { setImagemUrl(url); setFonteAberta(false); }}
                              title="Usar esta foto"
                              className="h-14 w-14 overflow-hidden rounded border border-zinc-200 hover:ring-2 hover:ring-brand-400"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {fonteBuscou && fonteResultados.length === 0 && (
                      <p className="py-2 text-center text-xs text-zinc-500">Nenhum produto com foto nesta busca.</p>
                    )}
                  </div>
                  <button onClick={() => setFonteAberta(false)} className="text-xs text-zinc-500 hover:text-zinc-800">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-1 font-semibold">
            2. Produtos selecionados
            <span className="ml-1 text-brand-600">({idsSelecionados.length})</span>
          </h2>
          {idsSelecionados.length === 0 ? (
            <p className="text-sm text-zinc-500">Busque e marque os produtos ao lado.</p>
          ) : (
            <>
              <div className="max-h-52 space-y-1 overflow-y-auto py-1">
                {idsSelecionados.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span className="font-mono text-xs text-zinc-400">{selecionados[id].codigo}</span>{" "}
                      {selecionados[id].nome}
                    </span>
                    <button
                      onClick={() => setSelecionados((s) => { const n = { ...s }; delete n[id]; return n; })}
                      className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                      aria-label="Remover"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelecionados({})} className="mt-1 text-xs text-zinc-500 hover:text-red-600">
                Limpar seleção
              </button>
            </>
          )}
        </div>

        <button
          onClick={aplicar}
          disabled={!imagemUrl || idsSelecionados.length === 0 || aplicando}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {aplicando
            ? "Aplicando..."
            : `Aplicar foto em ${idsSelecionados.length} produto${idsSelecionados.length === 1 ? "" : "s"}`}
        </button>
        {!imagemUrl && (
          <p className="text-center text-xs text-zinc-400">Escolha uma foto para habilitar.</p>
        )}
        {msg && (
          <p className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.texto}
          </p>
        )}
      </div>

      {/* Coluna direita: busca + resultados */}
      <div className="space-y-3">
        <form onSubmit={buscar} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou código do produto..."
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <button type="submit" disabled={buscando} className="rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50">
            {buscando ? "..." : "Buscar"}
          </button>
        </form>

        {buscou && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 text-zinc-600">
              <input type="checkbox" checked={soSemFoto} onChange={(e) => setSoSemFoto(e.target.checked)} />
              Mostrar só produtos sem foto
            </label>
            {visiveis.length > 0 && (
              <button onClick={selecionarVisiveis} className="font-medium text-brand-600 hover:underline">
                Selecionar todos ({visiveis.length})
              </button>
            )}
          </div>
        )}

        <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {visiveis.map((p) => {
            const marcado = !!selecionados[p.id];
            const n = p.imagens.length;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 ${marcado ? "bg-brand-50/50" : ""}`}
              >
                <input type="checkbox" checked={marcado} onChange={() => toggle(p)} />
                <span className="flex-1 truncate">
                  <span className="font-mono text-xs text-zinc-400">{p.codigo}</span> {p.nome}
                  {!p.ativo && <span className="ml-2 rounded bg-zinc-200 px-1.5 text-[10px] font-semibold text-zinc-600">inativo</span>}
                </span>
                <span className={`shrink-0 text-xs ${n === 0 ? "font-semibold text-amber-600" : "text-zinc-400"}`}>
                  {n === 0 ? "sem foto" : `${n} foto${n === 1 ? "" : "s"}`}
                </span>
              </label>
            );
          })}
          {buscou && visiveis.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              {soSemFoto ? "Nenhum produto sem foto nesta busca." : "Nenhum produto encontrado."}
            </p>
          )}
          {!buscou && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Busque produtos para começar. A foto escolhida será <b>adicionada</b>{" "}
              aos selecionados (não substitui as que já têm, e não duplica se já estiver lá).
            </p>
          )}
        </div>
        {resultados.length >= 80 && (
          <p className="text-xs text-zinc-400">
            Mostrando os primeiros 80 resultados — refine a busca se faltar algum.
          </p>
        )}
      </div>

      <p className="lg:col-span-2">
        <Link href="/admin/produtos" className="text-sm text-brand-600 hover:underline">
          ← Voltar para Produtos
        </Link>
      </p>
    </div>
  );
}
