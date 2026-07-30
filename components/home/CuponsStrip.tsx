import type { CupomHome } from "@/types";

// O ticker roda com duas faixas idênticas lado a lado: a animação desloca cada
// uma em -100% da SUA largura, então no fim do ciclo a segunda está exatamente
// onde a primeira começou e o loop não tem emenda.
//
// `min-w-full` faz cada faixa cobrir a tela inteira mesmo com poucos cupons —
// era o bug: com uma faixa mais estreita que a tela, sobrava um vão vazio no
// meio do ciclo. `shrink-0` impede o flex de espremer as duas em 50% cada.

// Poucos cupons = faixa curta demais; repete a lista até encher.
const MIN_ITENS = 4;
// Velocidade de rolagem em px/s — calibra a duração conforme o conteúdo.
const PX_POR_SEG = 60;

export function CuponsStrip({ cupons }: { cupons: CupomHome[] }) {
  if (cupons.length === 0) return null;

  const repeticoes = Math.ceil(MIN_ITENS / cupons.length);
  const faixa = Array.from({ length: repeticoes }, () => cupons).flat();
  const duracao = Math.max(20, Math.round(larguraAprox(faixa) / PX_POR_SEG));

  return (
    <div className="flex overflow-hidden bg-brand-500 py-2">
      <Faixa cupons={faixa} duracao={duracao} />
      <Faixa cupons={faixa} duracao={duracao} oculta />
    </div>
  );
}

function Faixa({
  cupons,
  duracao,
  oculta,
}: {
  cupons: CupomHome[];
  duracao: number;
  oculta?: boolean;
}) {
  return (
    <div
      aria-hidden={oculta}
      style={{ animationDuration: `${duracao}s` }}
      className="flex min-w-full shrink-0 animate-marquee items-center justify-around whitespace-nowrap motion-reduce:animate-none"
    >
      {cupons.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-3 px-8">
          <span className="font-mono text-[11px] font-bold uppercase tracking-mono text-white">
            {rotuloValor(c)}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-mono text-white/80">
            {rotuloDescricao(c)}
          </span>
          <span className="border border-white/50 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-mono text-white">
            {c.codigo}
          </span>
          <span className="mx-2 text-white/40">·</span>
        </span>
      ))}
    </div>
  );
}

const rotuloValor = (c: CupomHome) =>
  c.tipo === "percentual" ? `${c.valor}% OFF` : `R$${c.valor} OFF`;

const rotuloDescricao = (c: CupomHome) => c.descricao ?? "com o cupom";

/**
 * Largura aproximada da faixa, em px. Serve só pra calibrar a velocidade — o
 * layout não depende disso. Como o texto é monoespaçado, dá pra estimar por
 * caractere: ~7,5px nos rótulos (11px) e ~8,2px no código (12px), mais ~150px
 * de padding, gaps e bordas por item.
 */
function larguraAprox(cupons: CupomHome[]): number {
  return cupons.reduce((total, c) => {
    const chars = rotuloValor(c).length + rotuloDescricao(c).length;
    return total + 150 + chars * 7.5 + c.codigo.length * 8.2;
  }, 0);
}
