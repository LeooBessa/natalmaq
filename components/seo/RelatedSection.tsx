// Orquestrador dos blocos de "relacionados" ao final do artigo/landing.
// Ordem: Produtos -> Categorias/Marcas -> Leia também. Cada sub-bloco só renderiza
// se tiver itens (os próprios componentes retornam null quando vazios). RSC.
//
// Por que NÃO recebe um RelatedBundle cru: o bundle traz LinkTarget[] (só
// nome/href/slug). Render real exige dados de exibição (ProdutoComMarca para os
// cards de produto; image/excerpt/date para os cards de artigo). O caller (rota)
// resolve essas partes a custo controlado e passa aqui já prontas — categorias e
// marcas seguem como LinkTarget[] (chips só precisam de nome+href).

import { RelatedProducts } from "@/components/seo/RelatedProducts";
import {
  CategoriasRelacionadas,
} from "@/components/seo/CategoriasRelacionadas";
import { LeiaTambem, type LeiaTambemArticle } from "@/components/seo/LeiaTambem";
import type { LinkTarget } from "@/lib/seo/internal-links";
import type { ProdutoComMarca } from "@/types";

interface RelatedSectionProps {
  /** produtos JÁ resolvidos (do bundle.produtos -> lib/data por slug/id). */
  produtos?: ProdutoComMarca[];
  /** categorias do bundle (LinkTarget[]; chips usam nome+href direto). */
  categorias?: LinkTarget[];
  /** marcas do bundle (LinkTarget[]). */
  marcas?: LinkTarget[];
  /** artigos JÁ resolvidos (do bundle.leiaTambem -> lib/conteudo). */
  leiaTambem?: LeiaTambemArticle[];
  /** pillar do cluster (bundle.pillar, type 'cluster'). */
  pillar?: LinkTarget;
}

export function RelatedSection({
  produtos = [],
  categorias = [],
  marcas = [],
  leiaTambem = [],
  pillar,
}: RelatedSectionProps) {
  const hasNada =
    produtos.length === 0 &&
    categorias.length === 0 &&
    marcas.length === 0 &&
    leiaTambem.length === 0 &&
    !pillar;
  if (hasNada) return null;

  return (
    <div className="border-t border-line pt-10">
      <RelatedProducts produtos={produtos} />
      <CategoriasRelacionadas categorias={categorias} marcas={marcas} />
      <LeiaTambem artigos={leiaTambem} pillar={pillar} />
    </div>
  );
}
