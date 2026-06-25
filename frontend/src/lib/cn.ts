import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Об'єднує умовні класи (clsx) та прибирає конфлікти Tailwind-утиліт
 * (twMerge), напр. cn("px-2", isWide && "px-4") -> "px-4", а не обидва.
 * Використовуємо в усіх компонентах замість ручної конкатенації рядків.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
