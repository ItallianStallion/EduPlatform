import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "teal" | "soft";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:   "bg-gold text-ink hover:bg-gold-dark active:scale-[0.98] shadow-sm shadow-gold/20 disabled:bg-gold/40 disabled:shadow-none",
  secondary: "bg-ink text-paper hover:bg-ink-light active:scale-[0.98] shadow-sm shadow-ink/15 disabled:bg-ink/40",
  ghost:     "bg-transparent text-ink border border-line hover:bg-ink/5 hover:border-line-strong active:scale-[0.98] disabled:opacity-40",
  danger:    "bg-coral text-white hover:bg-coral-dark active:scale-[0.98] shadow-sm shadow-coral/20 disabled:opacity-50",
  teal:      "bg-teal text-white hover:bg-teal-dark active:scale-[0.98] shadow-sm shadow-teal/20 disabled:opacity-50",
  soft:      "bg-ink/6 text-ink hover:bg-ink/10 active:scale-[0.98] disabled:opacity-40",
};

const SIZE: Record<Size, string> = {
  xs: "px-2.5 py-1    text-xs  gap-1.5 rounded-md",
  sm: "px-3.5 py-1.5  text-sm  gap-1.5 rounded-lg",
  md: "px-4   py-2.5  text-sm  gap-2   rounded-xl",
  lg: "px-6   py-3    text-base gap-2.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, className = "", children, disabled, leftIcon, rightIcon, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 cursor-pointer select-none disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  ),
);
Button.displayName = "Button";
