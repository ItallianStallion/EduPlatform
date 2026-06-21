import { apiClient } from "./client";
import type { CourseProgress, MyProgressItem } from "../types";

export const progressApi = {
  myProgress: async (): Promise<MyProgressItem[]> => {
    const res = await apiClient.get("/progress/me");
    const d = res.data.data;
    return d.courses ?? d ?? [];
  },

  setLessonCompleted: async (lessonId: string, completed = true): Promise<{ completed: boolean }> => {
    const res = await apiClient.post(`/progress/lessons/${lessonId}`, { completed });
    return res.data.data.progress ?? res.data.data;
  },

  courseProgress: async (courseId: string): Promise<CourseProgress> => {
    const res = await apiClient.get(`/progress/courses/${courseId}`);
    return res.data.data;
  },
};
