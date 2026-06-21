import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav className="flex items-center justify-center gap-1 pt-6" aria-label="Пагінація">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md p-2 text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Попередня сторінка"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, idx) => {
        const prev = pages[idx - 1];
        const showEllipsis = prev !== undefined && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-slate">…</span>}
            <button
              onClick={() => onChange(p)}
              className={`h-9 w-9 rounded-md text-sm font-medium font-mono ${
                p === page ? "bg-ink text-paper" : "text-ink hover:bg-ink/5"
              }`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          </span>
        );
      })}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md p-2 text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Наступна сторінка"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
