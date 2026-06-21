import { apiClient } from "./client";
import type { Category } from "../types";

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    const res = await apiClient.get("/categories");
    const d = res.data.data;
    return d.categories ?? d ?? [];
  },
};