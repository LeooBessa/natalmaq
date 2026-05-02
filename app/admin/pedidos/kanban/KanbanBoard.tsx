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
import { useMemo, useState, useTransition } from "react";

import { formatBRL } from "@/lib/format";
import { updateStatusAction } from "../actions";
import type { KanbanPedido } from "./page";

type Status = KanbanPedido["status"];

const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: "pendente", label: "Pendente", color: "bg-yellow-50 border-yellow-200" },
  { key: "aprovado", label: "Aprovado", color: "bg-blue-50 border-blue-200" },
  { key: "enviado", label: "Enviado", color: "bg-green-50 border-green-200" },
  { key: "recusado", label: "Recusado", color: "bg-red-50 border-red-200" },
];

export function KanbanBoard({ pedidos: inicial }: { pedidos: KanbanPedido[] }) {
  const [pedidos, setPedidos] = useState(inicial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<Status, KanbanPedido[]> = {
      pendente: [],
      aprovado: [],
      enviado: [],
      recusado: [],
    };
    for (const p of pedidos) map[p.status].push(p);
    return map;
  }, [pedidos]);

  const active = activeId ? pedidos.find((p) => p.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const pedidoId = String(e.active.id);
    const novo = e.over?.id ? (String(e.over.id) as Status) : null;
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.key}
              status={col.key}
              label={col.label}
              color={col.color}
              pedidos={grouped[col.key]}
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
  status: Status;
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
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{label}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">
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
