import { type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "../utils/cn";

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">;

/**
 * Обгортка над `useSortable`, що рендерить дитину через render-prop,
 * передаючи їй `isDragging` (для підсвічування зони) і `handleProps`
 * (щоб саме іконка-ручка, а не весь рядок, запускала драг).
 */
export function SortableItem({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  className?: string;
  children: (args: { isDragging: boolean; handleProps: SortableHandleProps }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-60", className)}
    >
      {children({ isDragging, handleProps: { attributes, listeners } })}
    </div>
  );
}

/** "Ручка" перетягування — 6-крапкова іконка з власною хіт-зоною та підтримкою клавіатури. */
export function DragHandle({
  handleProps,
  disabled,
  label = "Перетягнути для зміни порядку",
}: {
  handleProps?: SortableHandleProps;
  disabled?: boolean;
  label?: string;
}) {
  if (disabled || !handleProps) return <span className="h-4 w-4 shrink-0" aria-hidden="true" />;
  return (
    <button
      type="button"
      {...handleProps.attributes}
      {...handleProps.listeners}
      aria-label={label}
      className="shrink-0 cursor-grab touch-none rounded p-1 text-slate/50 transition-colors hover:bg-ink/5 hover:text-ink active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
