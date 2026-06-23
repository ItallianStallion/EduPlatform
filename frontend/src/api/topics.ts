import { apiClient } from "./client";
import type { Topic } from "../types";

export interface TopicUpsertPayload {
  title: string;
  description?: string | null;
  order?: number;
}

export const topicsApi = {
  listByCourse: async (courseId: string): Promise<Topic[]> => {
    const res = await apiClient.get(`/topics/course/${courseId}`);
    const d = res.data.data;
    return d.topics ?? d ?? [];
  },

  create: async (courseId: string, payload: TopicUpsertPayload): Promise<Topic> => {
    const res = await apiClient.post(`/topics/course/${courseId}`, payload);
    return res.data.data.topic ?? res.data.data;
  },

  update: async (topicId: string, payload: Partial<TopicUpsertPayload>): Promise<Topic> => {
    const res = await apiClient.patch(`/topics/${topicId}`, payload);
    return res.data.data.topic ?? res.data.data;
  },

  remove: async (topicId: string): Promise<void> => {
    await apiClient.delete(`/topics/${topicId}`);
  },

  assignLessons: async (topicId: string, lessonIds: string[]): Promise<Topic> => {
    const res = await apiClient.put(`/topics/${topicId}/lessons`, { lessonIds });
    return res.data.data.topic ?? res.data.data;
  },
};
