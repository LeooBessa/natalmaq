"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

import type { AbcRow } from "./page";

export function ExportButton({
  rows,
  periodoLabel,
  metricaKey,
}: {
  rows: AbcRow[];
  periodoLabel: string;
  metricaKey: string;
}) {
  const [gerando, setGerando] = useState(false);

  function exportar() {
    if (rows.length === 0) return;
    setGerando(true);
    try {
      const linhas = rows.map((r) => ({
        "#": r.rank,
        "Código": r.codigo,
        "Produto": r.nome,
        "Qtd. vendida": r.quantidade,
        "Pedidos": r.pedidos,
        "Faturamento (R$)": Number(r.receita.toFixed(2)),
        "% do total": Number(r.pct.toFixed(2)),
        "% acumulado": Number(r.cumPct.toFixed(2)),
        "Classe": r.classe,
      }));

      const ws = XLSX.utils.json_to_sheet(linhas);
      ws["!cols"] = [
        { wch: 5 },
        { wch: 14 },
        { wch: 44 },
        { wch: 12 },
        { wch: 9 },
        { wch: 16 },
        { wch: 11 },
        { wch: 12 },
        { wch: 8 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Curva ABC");

      const periodo = periodoLabel.toLowerCase().replace(/\s+/g, "-");
      const data = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `curva-abc-${metricaKey}-${periodo}-${data}.xlsx`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={gerando || rows.length === 0}
      className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {gerando ? "Gerando..." : "Exportar Excel"}
    </button>
  );
}
