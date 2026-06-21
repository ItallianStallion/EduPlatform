import { ApiError } from "../api/client";

export function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  if (!value || value === 0) return "Безкоштовно";
  return `${value.toFixed(0)} ₴`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.errors.length > 0) return err.errors.join("; ");
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Сталася непередбачена помилка";
}

export function initials(name: string, surname: string): string {
  return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase();
}

export const ROLE_LABELS: Record<string, string> = {
  student: "Студент",
  teacher: "Викладач",
  admin: "Адміністратор",
};

export const LESSON_TYPE_LABELS: Record<string, string> = {
  video: "Відео",
  text: "Текст",
  pdf: "PDF",
};

/** Перетворює звичайне YouTube-посилання на embed-формат для <iframe>. */
export function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    return url;
  } catch {
    return url;
  }
}
