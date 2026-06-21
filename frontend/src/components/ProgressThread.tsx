import { Check } from "lucide-react";

export interface ThreadItem {
  id: string;
  label: string;
  completed: boolean;
  active?: boolean;
}

/**
 * Сигнатурний елемент дизайну: уроки курсу як "бусини на нитці" —
 * метафора зошита/конспекту, що прошитий по корінцю. Заповнена золота
 * бусина = пройдений урок, контурна = ще ні, з акцентом на поточному.
 */
export function ProgressThread({
  items,
  onSelect,
}: {
  items: ThreadItem[];
  onSelect?: (id: string) => void;
}) {
  return (
    <ol className="relative flex flex-col">
      {items.map((item, idx) => (
        <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
          {idx < items.length - 1 && (
            <span className="thread-line absolute left-[11px] top-6 bottom-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => onSelect?.(item.id)}
            disabled={!onSelect}
            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
              item.completed
                ? "border-gold bg-gold text-ink"
                : item.active
                  ? "border-gold-dark bg-white text-gold-dark"
                  : "border-line bg-white text-slate/50"
            }`}
            aria-label={item.completed ? `${item.label} — пройдено` : item.label}
          >
            {item.completed ? <Check className="h-3.5 w-3.5" /> : idx + 1}
          </button>
          <button
            type="button"
            onClick={() => onSelect?.(item.id)}
            disabled={!onSelect}
            className={`pt-0.5 text-left text-sm leading-snug ${
              item.active ? "font-semibold text-ink" : "text-ink/80"
            } ${onSelect ? "hover:text-gold-dark" : ""}`}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ol>
  );
}
