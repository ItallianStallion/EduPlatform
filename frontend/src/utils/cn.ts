import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Об'єднує умовні класи (clsx) і коректно вирішує конфлікти
 * Tailwind-класів (twMerge), щоб пізніший клас завжди перекривав
 * раніший замість дублювання в DOM (наприклад `p-4` + `p-2` → `p-2`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
