"use client";

// Editor visual de blocos do artigo (ArticleBlock[]). Drag-and-drop com
// @dnd-kit/sortable (mesmo motor do Kanban, porém ordenável). Controlado:
// recebe value/onChange — o form-pai serializa em hidden input JSON no submit
// (mesmo truque do ProdutoForm com imagens, só que JSON). doc 05 §4.
//
// Tipos reais (lib/articles): heading | paragraph | list. FAQ/HowTo NÃO são
// blocos (campos estruturados à parte — ver FaqRepeater/HowToRepeater).

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useId } from "react";

import type { ArticleBlock } from "@/lib/articles";

const TIPO_BADGE: Record<ArticleBlock["type"], { label: string; cls: string }> = {
  heading: { label: "H2", cls: "bg-zinc-900 text-white" },
  paragraph: { label: "P", cls: "bg-zinc-200 text-zinc-700" },
  list: { label: "•", cls: "bg-brand-100 text-brand-700" },
};

export function BlocksEditor({
  value,
  onChange,
}: {
  value: ArticleBlock[];
  onChange: (blocks: ArticleBlock[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(String(active.id).replace("idx-", ""));
    const to = Number(String(over.id).replace("idx-", ""));
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    onChange(arrayMove(value, from, to));
  }

  function update(index: number, block: ArticleBlock) {
    onChange(value.map((b, i) => (i === index ? block : b)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add(type: ArticleBlock["type"]) {
    const novo: ArticleBlock =
      type === "list"
        ? { type: "list", items: [""] }
        : { type, text: "" };
    onChange([...value, novo]);
  }

  const ids = value.map((_, i) => `idx-${i}`);

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {value.map((block, i) => (
              <SortableBlock
                key={`idx-${i}`}
                sortId={`idx-${i}`}
                index={i}
                block={block}
                onUpdate={(b) => update(i, b)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {value.length === 0 && (
        <p className="rounded-md border-2 border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
          Nenhum bloco ainda. Adicione um parágrafo, título ou lista abaixo.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
        <AddButton onClick={() => add("paragraph")}>+ Parágrafo</AddButton>
        <AddButton onClick={() => add("heading")}>+ Título (H2)</AddButton>
        <AddButton onClick={() => add("list")}>+ Lista</AddButton>
      </div>
    </div>
  );
}

function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

function SortableBlock({
  sortId,
  index,
  block,
  onUpdate,
  onRemove,
}: {
  sortId: string;
  index: number;
  block: ArticleBlock;
  onUpdate: (b: ArticleBlock) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const badge = TIPO_BADGE[block.type];
  const taId = useId();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 rounded-md border border-zinc-200 bg-white p-2 ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="mt-1 cursor-grab touch-none rounded p-1 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing"
        aria-label="Reordenar bloco"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span
        className={`mt-1 inline-flex h-6 w-7 shrink-0 items-center justify-center rounded text-xs font-bold ${badge.cls}`}
      >
        {badge.label}
      </span>

      <div className="min-w-0 flex-1">
        {block.type === "list" ? (
          <ListEditor
            id={taId}
            items={block.items}
            onChange={(items) => onUpdate({ type: "list", items })}
          />
        ) : (
          <AutoGrowTextarea
            id={taId}
            value={block.text}
            placeholder={
              block.type === "heading"
                ? "Texto do subtítulo (H2)"
                : "Texto do parágrafo"
            }
            heading={block.type === "heading"}
            onChange={(text) => onUpdate({ type: block.type, text })}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="mt-1 h-fit rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
        aria-label={`Apagar bloco ${index + 1}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AutoGrowTextarea({
  id,
  value,
  onChange,
  placeholder,
  heading,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  heading?: boolean;
}) {
  return (
    <textarea
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.max(1, value.split("\n").length)}
      className={`w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 ${
        heading ? "font-semibold" : ""
      }`}
    />
  );
}

// Lista = um item por linha (mesmo padrão do textarea de imagens do produto).
function ListEditor({
  id,
  items,
  onChange,
}: {
  id: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <textarea
      id={id}
      value={items.join("\n")}
      placeholder={"Um item por linha\nOutro item"}
      onChange={(e) => onChange(e.target.value.split("\n"))}
      rows={Math.max(2, items.length)}
      className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
    />
  );
}
