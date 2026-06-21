import type { ReactNode } from "react";
import { Loader2, Inbox } from "lucide-react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "teal" | "coral";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink/5 text-ink/70",
    gold: "bg-gold/15 text-gold-dark",
    teal: "bg-teal/10 text-teal-dark",
    coral: "bg-coral/10 text-coral-dark",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label = "Завантаження…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-white/50 px-6 py-16 text-center">
      <Inbox className="h-8 w-8 text-slate/50" />
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate">{description}</p>}
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-paper-raised ${className}`}>{children}</div>
  );
}
