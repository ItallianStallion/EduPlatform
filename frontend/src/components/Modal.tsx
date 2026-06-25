import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export function Modal({
  isOpen, onClose, title, description, size = "md", children,
}: {
  isOpen: boolean; onClose: () => void; title: string;
  description?: string; size?: "sm" | "md" | "lg"; children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Фокус на перше поле форми (а не на хрестик закриття в шапці модалки).
    setTimeout(() => {
      bodyRef.current?.querySelector<HTMLElement>(
        "button,input,select,textarea,[tabindex]:not([tabindex='-1'])"
      )?.focus();
    }, 30);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    // `onClose` свідомо не в залежностях: батьківські компоненти зазвичай передають
    // інлайн-функцію, яка створюється заново на кожен ре-рендер (напр. при кожному
    // натисканні клавіші в полі форми). Якби onClose був у залежностях, цей ефект
    // перезапускався б на кожен символ і знову переводив фокус — саме so "кидає на хрестик".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const maxW = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-0 sm:items-center sm:pb-4"
      role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative z-10 w-full ${maxW} max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-paper-raised shadow-xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4 shrink-0">
          <div>
            <h2 id="modal-title" className="font-display text-xl font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate">{description}</p>}
          </div>
          <button onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate transition-colors hover:bg-ink/6 hover:text-ink"
            aria-label="Закрити">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={bodyRef} className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  isOpen, title, description, confirmLabel = "Підтвердити",
  isDanger, isLoading, onConfirm, onCancel,
}: {
  isOpen: boolean; title: string; description?: string;
  confirmLabel?: string; isDanger?: boolean; isLoading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-paper-raised p-6 shadow-xl">
        {isDanger && (
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-coral-light">
            <X className="h-5 w-5 text-coral-dark" />
          </div>
        )}
        <h2 id="confirm-title" className="font-display text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>Скасувати</Button>
          <Button variant={isDanger ? "danger" : "primary"} size="sm" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
