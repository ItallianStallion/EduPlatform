import { apiClient } from "./client";
import type { AnalyticsDashboard, CourseAnalytics, CourseStudent } from "../types";

export const analyticsApi = {
  dashboard: async (): Promise<AnalyticsDashboard> => {
    const res = await apiClient.get("/analytics/dashboard");
    return res.data.data;
  },

  courseAnalytics: async (courseId: string): Promise<CourseAnalytics> => {
    const res = await apiClient.get(`/analytics/courses/${courseId}`);
    return res.data.data;
  },

  courseStudents: async (courseId: string): Promise<CourseStudent[]> => {
    const res = await apiClient.get(`/analytics/courses/${courseId}/students`);
    const d = res.data.data;
    return d.students ?? d ?? [];
  },
};
