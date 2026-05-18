import type { AbcRow } from "./page";
import { formatBRL } from "@/lib/format";

const CLASSE_FILL: Record<string, string> = {
  A: "#059669", // emerald-600
  B: "#d97706", // amber-600
  C: "#a1a1aa", // zinc-400
};

function compacto(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

export function ParetoChart({
  rows,
  porQtd,
}: {
  rows: AbcRow[];
  porQtd: boolean;
}) {
  const dados = rows.slice(0, 30);
  if (dados.length === 0) return null;

  // Geometria
  const W = 920;
  const H = 340;
  const padL = 56;
  const padR = 48;
  const padT = 16;
  const padB = 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const plotBottom = padT + plotH;

  const maxValor = Math.max(...dados.map((d) => d.valor), 1);
  const slotW = plotW / dados.length;
  const barW = Math.min(slotW * 0.62, 40);

  const yValor = (v: number) => plotBottom - (v / maxValor) * plotH;
  const yPct = (p: number) => plotBottom - (p / 100) * plotH;
  const cx = (i: number) => padL + i * slotW + slotW / 2;

  const linhaPontos = dados
    .map((d, i) => `${cx(i).toFixed(1)},${yPct(d.cumPct).toFixed(1)}`)
    .join(" ");

  const fmt = (n: number) =>
    porQtd ? `${n.toLocaleString("pt-BR")} un` : formatBRL(n);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-label="Gráfico de Pareto da Curva ABC"
      >
        {/* Grade horizontal + eixo esquerdo (métrica) */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = plotBottom - f * plotH;
          return (
            <g key={f}>
              <line
                x1={padL}
                y1={y}
                x2={padL + plotW}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth={1}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="#71717a"
              >
                {compacto(maxValor * f)}
              </text>
            </g>
          );
        })}

        {/* Eixo direito (% acumulado) */}
        {[0, 20, 40, 60, 80, 100].map((p) => (
          <text
            key={p}
            x={padL + plotW + 8}
            y={yPct(p) + 3}
            textAnchor="start"
            fontSize={10}
            fill="#71717a"
          >
            {p}%
          </text>
        ))}

        {/* Linhas de referência 80% e 95% */}
        {[
          { p: 80, cor: "#10b981" },
          { p: 95, cor: "#f59e0b" },
        ].map(({ p, cor }) => (
          <g key={p}>
            <line
              x1={padL}
              y1={yPct(p)}
              x2={padL + plotW}
              y2={yPct(p)}
              stroke={cor}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={padL + 4}
              y={yPct(p) - 4}
              fontSize={9}
              fill={cor}
              fontWeight="bold"
            >
              {p}%
            </text>
          </g>
        ))}

        {/* Barras */}
        {dados.map((d, i) => {
          const x = cx(i) - barW / 2;
          const y = yValor(d.valor);
          const h = plotBottom - y;
          return (
            <rect
              key={d.produto_id ?? `cod:${d.codigo}`}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0)}
              fill={CLASSE_FILL[d.classe]}
              rx={2}
            >
              <title>
                {`#${d.rank} ${d.codigo} — ${d.nome}\n${fmt(d.valor)} · ${d.pct.toFixed(1)}% · acum. ${d.cumPct.toFixed(1)}% · Classe ${d.classe}`}
              </title>
            </rect>
          );
        })}

        {/* Linha de % acumulado */}
        <polyline
          points={linhaPontos}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={2}
        />
        {dados.map((d, i) => (
          <circle
            key={`pt-${d.produto_id ?? d.codigo}`}
            cx={cx(i)}
            cy={yPct(d.cumPct)}
            r={2.6}
            fill="#4f46e5"
          />
        ))}

        {/* Eixo X (ranking) */}
        <line
          x1={padL}
          y1={plotBottom}
          x2={padL + plotW}
          y2={plotBottom}
          stroke="#a1a1aa"
          strokeWidth={1}
        />
        {dados.map((d, i) => {
          // mostra rótulo a cada N barras para não poluir
          const passo = dados.length > 18 ? 5 : dados.length > 10 ? 2 : 1;
          if (i % passo !== 0) return null;
          return (
            <text
              key={`x-${i}`}
              x={cx(i)}
              y={plotBottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#71717a"
            >
              {d.rank}
            </text>
          );
        })}
        <text
          x={padL + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={10}
          fill="#a1a1aa"
        >
          produtos (ranking por {porQtd ? "quantidade" : "faturamento"} →)
        </text>
      </svg>

      {/* Legenda */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CLASSE_FILL.A }} />
          Classe A
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CLASSE_FILL.B }} />
          Classe B
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CLASSE_FILL.C }} />
          Classe C
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: "#4f46e5" }} />
          % acumulado
        </span>
      </div>
    </div>
  );
}
