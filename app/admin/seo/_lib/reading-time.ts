// Tempo de leitura calculado (não digitado) — doc 05 §4.
// Conta palavras dos blocos de texto (paragraph + list) e divide por 200 ppm.
// Função PURA (server + client). Blocos "heading" não entram na contagem.
import type { ArticleBlock } from "@/lib/articles";

const PALAVRAS_POR_MINUTO = 200;

function contarPalavras(texto: string): number {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingTimeMin(blocks: ArticleBlock[]): number {
  let palavras = 0;
  for (const bloco of blocks) {
    if (bloco.type === "paragraph") {
      palavras += contarPalavras(bloco.text);
    } else if (bloco.type === "list") {
      for (const item of bloco.items) palavras += contarPalavras(item);
    }
    // headings não contam para o tempo de leitura
  }
  return Math.max(1, Math.ceil(palavras / PALAVRAS_POR_MINUTO));
}

export function readingTimeLabel(min: number): string {
  return `${min} min de leitura`;
}
