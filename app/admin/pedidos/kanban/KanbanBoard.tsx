"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { ArrowDownUp } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { formatBRL } from "@/lib/format";
import { updateStatusAction } from "../actions";
import {
  PEDIDO_STATUS,
  PEDIDO_STATUS_KANBAN,
  PEDIDO_STATUS_LABEL,
  type PedidoStatus,
} from "../_lib/status";
import type { KanbanPedido } from "./page";

type SortBy = "data_asc" | "data_desc" | "valor_asc" | "valor_desc";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "data_asc", label: "Mais antigos (FIFO)" },
  { value: "data_desc", label: "Mais recentes" },
  { value: "valor_asc", label: "Menor valor" },
  { value: "valor_desc", label: "Maior valor" },
];

function sortPedidos(arr: KanbanPedido[], sortBy: SortBy): KanbanPedido[] {
  const copy = [...arr];
  switch (sortBy) {
    case "data_asc":
      return copy.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    case "data_desc":
      return copy.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    case "valor_asc":
      return copy.sort((a, b) => Number(a.total) - Number(b.total));
    case "valor_desc":
      return copy.sort((a, b) => Number(b.total) - Number(a.total));
  }
}

export function KanbanBoard({ pedidos: inicial }: { pedidos: KanbanPedido[] }) {
  const [pedidos, setPedidos] = useState(inicial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Ordenacao GLOBAL (1 select, aplica em todas as colunas).
  const [sortBy, setSortBy] = useState<SortBy>("data_asc");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<PedidoStatus, KanbanPedido[]> = {
      pendente: [],
      aprovado: [],
      confirmado: [],
      enviado: [],
      recusado: [],
    };
    for (const p of pedidos) map[p.status].push(p);
    for (const k of PEDIDO_STATUS) {
      map[k] = sortPedidos(map[k], sortBy);
    }
    return map;
  }, [pedidos, sortBy]);

  const active = activeId ? pedidos.find((p) => p.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const pedidoId = String(e.active.id);
    const novo = e.over?.id ? (String(e.over.id) as PedidoStatus) : null;
    if (!novo) return;
    const atual = pedidos.find((p) => p.id === pedidoId);
    if (!atual || atual.status === novo) return;

    // Update otimista
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, status: novo } : p)),
    );
    setErro(null);
    startTransition(async () => {
      const r = await updateStatusAction(pedidoId, novo);
      if (!r.ok) {
        setErro(r.error ?? "Falha ao atualizar.");
        // rollback
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, status: atual.status } : p)),
        );
      }
    });
  }

  return (
    <>
      {erro && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      {/* Filtro único de ordenação (aplica em todas as colunas) */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2">
        <ArrowDownUp className="h-4 w-4 shrink-0 text-zinc-500" />
        <label htmlFor="kanban-sort" className="text-sm font-medium text-zinc-600">
          Ordenar todas as colunas por:
        </label>
        <select
          id="kanban-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PEDIDO_STATUS.map((key) => (
            <Column
              key={key}
              status={key}
              label={PEDIDO_STATUS_LABEL[key]}
              color={PEDIDO_STATUS_KANBAN[key]}
              pedidos={grouped[key]}
            />
          ))}
        </div>

        <DragOverlay>
          {active ? <Card pedido={active} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function Column({
  status,
  label,
  color,
  pedidos,
}: {
  status: PedidoStatus;
  label: string;
  color: string;
  pedidos: KanbanPedido[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[400px] flex-col rounded-lg border p-3 transition ${color} ${
        isOver ? "ring-2 ring-brand-400" : ""
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold leading-tight">{label}</h2>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold">
          {pedidos.length}
        </span>
      </header>

      <div className="space-y-2">
        {pedidos.map((p) => (
          <Card key={p.id} pedido={p} />
        ))}
        {pedidos.length === 0 && (
          <p className="rounded border-2 border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
            vazio
          </p>
        )}
      </div>
    </div>
  );
}

function Card({
  pedido,
  dragging,
}: {
  pedido: KanbanPedido;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: pedido.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border border-zinc-200 bg-white p-3 shadow-sm transition ${
        isDragging ? "opacity-30" : "hover:shadow"
      } ${dragging ? "shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/pedidos/${pedido.id}` as never}
          className="font-mono text-xs font-semibold text-brand-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          #{String(pedido.numero).padStart(5, "0")}
        </Link>
        <span className="text-xs text-zinc-400">
          {new Date(pedido.criado_em).toLocaleDateString("pt-BR")}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">{pedido.cliente_nome}</p>
      <p className="text-xs text-zinc-500">{pedido.cliente_telefone}</p>
      <p className="mt-2 text-sm font-bold">{formatBRL(Number(pedido.total))}</p>
    </div>
  );
}
