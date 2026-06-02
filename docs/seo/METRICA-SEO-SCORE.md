# Métrica de SEO on-page (score 0–100) — reutilizável

Documento **portátil** (agnóstico de framework). Descreve a métrica de SEO
on-page usada no Natalmaq para pontuar artigos no editor, em tempo real. É
**determinística** (mesma entrada → mesma nota, sem API paga) e **orientativa**
(mostra o que melhorar; **não bloqueia** a publicação).

Implementação de referência: `lib/seo/score.ts` (função pura `scoreArtigo`).

## Fórmula

```
score = round( (soma dos pesos das checagens que PASSARAM / soma de TODOS os pesos) * 100 )
```

Soma total dos pesos = **78**. Cada checagem é booleana (passou/não passou).
A nota é um percentual 0–100.

## As 12 checagens (com peso e limiar)

| # | Checagem | Limiar | Peso | Por quê |
|---|---|---|---|---|
| 1 | **Título** | 30–60 caracteres | 8 | Cabe no resultado do Google sem cortar |
| 2 | **Meta descrição** | 110–160 caracteres | 8 | Snippet completo, sem truncar |
| 3 | **Keyword no título** | keyword principal presente no título | 8 | Relevância para o termo-alvo |
| 4 | **Keyword no 1º parágrafo** | nos ~150 primeiros caracteres do corpo | 8 | Sinaliza o tema cedo |
| 5 | **Densidade da keyword** | 0,4%–2,5% | 8 | Relevante sem *keyword stuffing* |
| 6 | **Subtítulos (H2)** | ≥ 2 H2 | 8 | Estrutura escaneável |
| 7 | **Índice viável (TOC)** | ≥ 3 H2 | 3 | Permite sumário / âncoras |
| 8 | **Alt de imagem** | 5–125 chars e ≠ título | 6 | Acessibilidade + SEO de imagem |
| 9 | **Tamanho do conteúdo** | ≥ 600 palavras | 6 | Profundidade suficiente |
| 10 | **Parágrafos curtos** | nenhum > 100 palavras | 5 | Legibilidade (humano + IA) |
| 11 | **FAQ** | ≥ 2 perguntas | 6 | Habilita FAQPage / bom p/ AI Overviews |
| 12 | **Slug saudável** | kebab-case, ≤ 80 chars | 4 | URL limpa e estável |

> A keyword principal = primeiro item da lista de keywords. A densidade conta
> ocorrências do **radical** da keyword (primeira palavra) sobre o total de
> palavras do corpo. Comparações são **normalizadas** (minúsculas, sem acento).

## Como reutilizar em outro projeto

1. **Copie a ideia, não o schema.** A função recebe `{ titulo, excerpt,
   keywords[], conteudo[], imagemAlt, slug, faq[] }`. Mapeie esses campos para
   os do seu projeto.
2. **Mantenha determinística e pura** — sem rede, sem IA paga. Roda no cliente/
   servidor instantaneamente e dá feedback ao vivo no editor.
3. **Use como guia, não trava.** Mostre a barra 0–100 + a lista de itens com
   `ok/hint`; deixe publicar mesmo com nota baixa.
4. **Ajuste limiares ao formato.** Os valores acima são para artigos editoriais.
   Para fichas de produto/landing, reduza o mínimo de palavras e adapte os pesos.
5. **Normalize texto** (minúsculas + sem acento) antes de comparar keyword.

## A métrica não vive sozinha

O score cobre **on-page**. No Natalmaq ele compõe um sistema de SEO maior, de
**custo zero em runtime** (conteúdo no banco, sem API paga), que inclui:

- **Arquitetura hub-and-spoke**: pillar/cluster (`/guias`) + artigos satélite +
  landing pages (`/solucoes`).
- **Schema rico (JSON-LD)**: BlogPosting + Person (E-E-A-T), Product+Offer,
  Store/LocalBusiness, BreadcrumbList, FAQPage, HowTo, CollectionPage+ItemList.
- **Linkagem interna**: "Leia também" (artigo→artigo, mesmo cluster + pillar).
- **Fundação técnica**: `sitemap.xml` dinâmico do banco, `robots`, metadados
  (`generateMetadata`), `revalidate`/ISR.
- **Busca de produtos**: full-text (tsvector + unaccent) com prioridade de
  prefixo — ver a barra de busca do catálogo.

Detalhes e decisões completas: ver os docs `00`–`05` nesta pasta.
