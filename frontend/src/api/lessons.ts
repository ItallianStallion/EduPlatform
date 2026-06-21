import { apiClient } from "./client";
import type { CourseBlock, Lesson, LessonType } from "../types";

export interface LessonUpsertPayload {
  title: string;
  type?: LessonType;
  content?: string | null;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  order?: number;
}

export const lessonsApi = {
  listByCourse: async (courseId: string): Promise<Lesson[]> => {
    const res = await apiClient.get(`/lessons/course/${courseId}`);
    const d = res.data.data;
    return d.lessons ?? d ?? [];
  },

  /** Курс як список блоків "урок (+ опційний тест)" — головний ендпоінт для сторінки курсу. */
  getBlocks: async (courseId: string): Promise<CourseBlock[]> => {
    const res = await apiClient.get(`/lessons/course/${courseId}/blocks`);
    const d = res.data.data;
    return d.blocks ?? d ?? [];
  },

  getById: async (id: string): Promise<Lesson> => {
    const res = await apiClient.get(`/lessons/${id}`);
    return res.data.data.lesson ?? res.data.data;
  },

  create: async (courseId: string, payload: LessonUpsertPayload): Promise<Lesson> => {
    const res = await apiClient.post(`/lessons/course/${courseId}`, payload);
    return res.data.data.lesson ?? res.data.data;
  },

  update: async (id: string, payload: Partial<LessonUpsertPayload>): Promise<Lesson> => {
    const res = await apiClient.patch(`/lessons/${id}`, payload);
    return res.data.data.lesson ?? res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/lessons/${id}`);
  },
};
