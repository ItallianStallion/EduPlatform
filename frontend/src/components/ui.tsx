import type { ReactNode } from "react";

// ── Badge ─────────────────────────────────────────────────────────
type BadgeTone = "neutral" | "gold" | "teal" | "coral" | "ink";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink/6 text-ink/60 border border-ink/8",
  gold:    "bg-gold/12 text-gold-dark border border-gold/20",
  teal:    "bg-teal/10 text-teal-dark border border-teal/15",
  coral:   "bg-coral/10 text-coral-dark border border-coral/15",
  ink:     "bg-ink text-paper border border-ink",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({ label = "Завантаження…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate" role="status" aria-label={label}>
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-2 border-line" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-dark" />
      </div>
      <p className="text-xs font-medium text-slate-light">{label}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <div className="mt-1 flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col divide-y divide-line rounded-xl border border-line overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-4 w-4 rounded-full shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────
export function EmptyState({
  title, description, action,
}: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-paper-sunken/40 px-6 py-14 text-center">
      <svg viewBox="0 0 96 64" className="h-16 w-24 text-ink/20" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="80" height="48" rx="6" fill="currentColor" opacity="0.5"/>
        <rect x="18" y="18" width="60" height="6" rx="3" fill="currentColor" opacity="0.8"/>
        <rect x="18" y="30" width="44" height="4" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="18" y="40" width="32" height="4" rx="2" fill="currentColor" opacity="0.35"/>
        <circle cx="80" cy="14" r="10" fill="currentColor" opacity="0.4"/>
        <path d="M76 14h8M80 10v8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1.5 mx-auto max-w-xs text-sm leading-relaxed text-slate">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────
export function Card({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</div>
  );
}

// ── Divider ───────────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="border-line" />;
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-light">{label}</span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
