import {
  type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface FieldWrapperProps {
  label: string; htmlFor: string; error?: string;
  hint?: string; success?: string; required?: boolean; children: ReactNode;
}

function FieldWrapper({ label, htmlFor, error, hint, success, required, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-coral-dark" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && !success && <p className="text-xs text-slate">{hint}</p>}
      {success && !error && (
        <p className="flex items-center gap-1 text-xs text-teal-dark">
          <CheckCircle2 className="h-3 w-3" />{success}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-coral-dark" role="alert">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

const base = [
  "w-full rounded-xl border bg-paper-raised px-3.5 py-2.5 text-sm text-ink",
  "placeholder:text-slate-light/80 transition-all duration-150",
  "border-line hover:border-line-strong",
  "focus:border-gold-dark focus:outline-none focus:ring-3 focus:ring-gold/20",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-paper-sunken",
].join(" ");

const errCls = "border-coral focus:border-coral focus:ring-coral/20";

// ── TextField ─────────────────────────────────────────────────────
interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string; error?: string; hint?: string; success?: string;
}
export function TextField({ label, error, hint, success, id, className = "", required, ...rest }: TextFieldProps) {
  const fid = id ?? (rest.name as string) ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fid} error={error} hint={hint} success={success} required={required}>
      <input id={fid} required={required} aria-invalid={!!error}
        className={`${base} ${error ? errCls : ""} ${className}`} {...rest} />
    </FieldWrapper>
  );
}

// ── TextAreaField ─────────────────────────────────────────────────
interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string; error?: string; hint?: string;
}
export function TextAreaField({ label, error, hint, id, className = "", required, ...rest }: TextAreaFieldProps) {
  const fid = id ?? (rest.name as string) ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fid} error={error} hint={hint} required={required}>
      <textarea id={fid} required={required} aria-invalid={!!error}
        className={`${base} resize-none ${error ? errCls : ""} ${className}`} {...rest} />
    </FieldWrapper>
  );
}

// ── SelectField ───────────────────────────────────────────────────
interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string; error?: string; hint?: string; children: ReactNode;
}
export function SelectField({ label, error, hint, id, className = "", children, required, ...rest }: SelectFieldProps) {
  const fid = id ?? (rest.name as string) ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fid} error={error} hint={hint} required={required}>
      <select id={fid} required={required} aria-invalid={!!error}
        className={`${base} cursor-pointer ${error ? errCls : ""} ${className}`} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
}
