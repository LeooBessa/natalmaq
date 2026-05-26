import { Clock, AlertTriangle } from "lucide-react";
import {
  PEDIDO_STATUS_BORDER,
  PEDIDO_STATUS_LABEL,
  PEDIDO_STATUS_TEXT,
  type PedidoStatus,
} from "../_lib/status";

type Props = {
  status: PedidoStatus;
  criado_em: string;
  aprovado_em: string | null;
  confirmado_em: string | null;
  enviado_em: string | null;
  recusado_em: string | null;
};

type Etapa = {
  status: PedidoStatus;
  timestamp: string | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1min";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}min`;
  const horas = Math.floor(mins / 60);
  const minsRest = mins % 60;
  if (horas < 24) {
    return minsRest > 0 ? `${horas}h ${minsRest}min` : `${horas}h`;
  }
  const dias = Math.floor(horas / 24);
  const horasRest = horas % 24;
  return horasRest > 0 ? `${dias}d ${horasRest}h` : `${dias}d`;
}

export function PedidoTimeline({
  status,
  criado_em,
  aprovado_em,
  confirmado_em,
  enviado_em,
  recusado_em,
}: Props) {
  // Se o pedido foi recusado, a timeline ramifica: mostra pendente -> recusado.
  // Se nao foi recusado, mostra o fluxo principal pendente -> aprovado -> confirmado -> enviado.
  const foiRecusado = status === "recusado";

  const etapas: Etapa[] = foiRecusado
    ? [
        { status: "pendente", timestamp: criado_em },
        { status: "recusado", timestamp: recusado_em },
      ]
    : [
        { status: "pendente", timestamp: criado_em },
        { status: "aprovado", timestamp: aprovado_em },
        { status: "confirmado", timestamp: confirmado_em },
        { status: "enviado", timestamp: enviado_em },
      ];

  // Calcula duracoes entre etapas concluidas
  const duracoes: { idx: number; ms: number }[] = [];
  for (let i = 1; i < etapas.length; i++) {
    const prev = etapas[i - 1].timestamp;
    const curr = etapas[i].timestamp;
    if (prev && curr) {
      const ms = new Date(curr).getTime() - new Date(prev).getTime();
      duracoes.push({ idx: i, ms });
    }
  }

  // Identifica gargalo (maior duracao). So destaca se tiver pelo menos 2
  // duracoes pra comparar (senao "maior" perde sentido).
  const gargaloIdx =
    duracoes.length >= 2
      ? duracoes.reduce((max, d) => (d.ms > max.ms ? d : max)).idx
      : null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-zinc-500" />
        <h2 className="font-semibold">Linha do tempo</h2>
      </div>

      <ol className="space-y-0">
        {etapas.map((etapa, i) => {
          const concluida = etapa.timestamp !== null;
          const isAtual = etapa.status === status;
          const prev = i > 0 ? etapas[i - 1] : null;
          const duracao =
            i > 0 && prev?.timestamp && etapa.timestamp
              ? new Date(etapa.timestamp).getTime() -
                new Date(prev.timestamp).getTime()
              : null;
          const isGargalo = gargaloIdx === i;

          return (
            <li key={etapa.status} className="relative flex gap-4">
              {/* Marker + linha vertical */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                    concluida
                      ? `${PEDIDO_STATUS_BORDER[etapa.status]} bg-white`
                      : "border-zinc-300 bg-zinc-100"
                  } ${isAtual ? "ring-2 ring-offset-1 ring-zinc-300" : ""}`}
                />
                {i < etapas.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 ${
                      concluida && etapas[i + 1].timestamp
                        ? "bg-zinc-300"
                        : "bg-zinc-200"
                    }`}
                    style={{ minHeight: "32px" }}
                  />
                )}
              </div>

              {/* Conteudo */}
              <div className={`flex-1 pb-5 ${concluida ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      concluida
                        ? PEDIDO_STATUS_TEXT[etapa.status]
                        : "text-zinc-500"
                    }`}
                  >
                    {PEDIDO_STATUS_LABEL[etapa.status]}
                  </p>
                  {isAtual && (
                    <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      atual
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {etapa.timestamp ? formatDateTime(etapa.timestamp) : "—"}
                </p>
                {duracao !== null && (
                  <p
                    className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      isGargalo
                        ? "bg-orange-100 text-orange-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {isGargalo && <AlertTriangle className="h-3 w-3" />}
                    Levou {formatDuration(duracao)}
                    {isGargalo && " · maior etapa"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
