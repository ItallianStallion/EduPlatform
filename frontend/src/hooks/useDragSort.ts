import { useCallback, useRef, useState } from "react";

/**
 * Легка drag-and-drop реалізація для сортування плоских списків
 * (теми курсу, уроки в темі). Працює на pointer events, без
 * зовнішніх бібліотек — підʼєднується через рендер-проп `dragHandleProps`
 * на елемент-"ручку" (іконка з 6 крапок) і `dropIndicator` для зони між
 * елементами.
 *
 * Якщо проєкт пізніше захоче перейти на @dnd-kit/core +
 * @dnd-kit/sortable — інтерфейс useDragSort сумісний за духом
 * (items / onReorder), міграція займе один файл.
 */

export interface DragSortItem {
  id: string;
}

interface UseDragSortOptions<T extends DragSortItem> {
  items: T[];
  /** Викликається з новим порядком ОДРАЗУ (optimistic), коли drop підтверджено. */
  onReorder: (next: T[]) => void;
  /** Опційно: персист на бекенд (id, новий index). Помилка — і onReorder отримає попередній порядок ще раз ззовні. */
  disabled?: boolean;
}

export function useDragSort<T extends DragSortItem>({ items, onReorder, disabled }: UseDragSortOptions<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overEdge, setOverEdge] = useState<"top" | "bottom" | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handlePointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDraggedId(id);

      function onMove(ev: PointerEvent) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = el?.closest<HTMLElement>("[data-drag-row-id]");
        if (!row) return;
        const rowId = row.dataset.dragRowId!;
        const rect = row.getBoundingClientRect();
        const edge = ev.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
        setOverId(rowId);
        setOverEdge(edge);
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const draggedIdx = itemsRef.current.findIndex((it) => it.id === id);
        const targetId = overId;
        const edge = overEdge;
        setDraggedId(null);
        setOverId(null);
        setOverEdge(null);

        if (!targetId || targetId === id || draggedIdx === -1) return;

        const targetIdx = itemsRef.current.findIndex((it) => it.id === targetId);
        if (targetIdx === -1) return;

        const next = itemsRef.current.slice();
        const [moved] = next.splice(draggedIdx, 1);
        let insertAt = next.findIndex((it) => it.id === targetId);
        if (edge === "bottom") insertAt += 1;
        next.splice(insertAt, 0, moved);

        onReorder(next);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [disabled, onReorder, overEdge, overId],
  );

  /** Keyboard fallback for accessibility: Alt+ArrowUp / Alt+ArrowDown moves the row. */
  const handleKeyDown = useCallback(
    (id: string) => (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const idx = itemsRef.current.findIndex((it) => it.id === id);
      const targetIdx = e.key === "ArrowUp" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= itemsRef.current.length) return;
      const next = itemsRef.current.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      onReorder(next);
    },
    [disabled, onReorder],
  );

  return {
    draggedId,
    overId,
    overEdge,
    getRowProps: (id: string) => ({
      "data-drag-row-id": id,
    }),
    getHandleProps: (id: string) => ({
      onPointerDown: handlePointerDown(id),
      onKeyDown: handleKeyDown(id),
      tabIndex: disabled ? -1 : 0,
      role: "button" as const,
      "aria-label": "Перетягнути для зміни порядку. Alt+стрілка вгору/вниз для клавіатури.",
    }),
    isDragging: draggedId !== null,
  };
}
