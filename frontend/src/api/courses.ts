import { apiClient } from "./client";
import type { Course, Paginated, PriceFilter, SortBy } from "../types";

export interface CourseListQuery {
  q?: string;
  categoryId?: string;
  price?: PriceFilter;
  sortBy?: SortBy;
  page?: number;
  limit?: number;
}

export interface CourseUpsertPayload {
  title: string;
  description?: string;
  categoryId?: string | null;
  price?: number;
  coverImage?: string | null;
  accessMode?: "open" | "sequential";
}

export const coursesApi = {
  list: async (query: CourseListQuery): Promise<Paginated<Course>> => {
    const res = await apiClient.get("/courses", { params: query });
    const d = res.data.data;
    return {
      items: d.courses ?? d.items ?? [],
      totalPages: d.totalPages ?? 1,
      page: d.page ?? 1,
      totalCount: d.totalCount ?? 0,
      limit: d.limit ?? 12,
    };
  },

  myCourses: async (): Promise<Course[]> => {
    const res = await apiClient.get("/courses/my");
    const d = res.data.data;
    return d.courses ?? d.items ?? d ?? [];
  },

  getById: async (id: string): Promise<Course> => {
    const res = await apiClient.get(`/courses/${id}`);
    return res.data.data.course ?? res.data.data;
  },

  create: async (payload: CourseUpsertPayload): Promise<Course> => {
    const res = await apiClient.post("/courses", payload);
    return res.data.data.course ?? res.data.data;
  },

  update: async (id: string, payload: Partial<CourseUpsertPayload>): Promise<Course> => {
    const res = await apiClient.patch(`/courses/${id}`, payload);
    return res.data.data.course ?? res.data.data;
  },

  publish: async (id: string): Promise<Course> => {
    const res = await apiClient.patch(`/courses/${id}/publish`);
    return res.data.data.course ?? res.data.data;
  },

  unpublish: async (id: string): Promise<Course> => {
    const res = await apiClient.patch(`/courses/${id}/unpublish`);
    return res.data.data.course ?? res.data.data;
  },

  enroll: async (id: string) => {
    const res = await apiClient.post(`/courses/${id}/enroll`);
    return res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/courses/${id}`);
  },
};