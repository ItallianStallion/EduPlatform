import { apiClient } from "./client";
import type { Test, TestQuestion, TestSubmitResult, TestSummary } from "../types";

export interface TestCreatePayload {
  title: string;
  questions: TestQuestion[];
  passingScore?: number;
  maxAttempts?: number | null;
}

export interface TopicTestCreatePayload {
  title: string;
  questions: TestQuestion[];
  passingScore?: number;
  maxAttempts?: number | null;
}

export interface TestUpdatePayload {
  title?: string;
  questions?: TestQuestion[];
  passingScore?: number;
  maxAttempts?: number | null;
}

export const testsApi = {
  // ── Legacy: один тест на весь курс ──────────────────────────
  getByCourse: async (courseId: string): Promise<Test> => {
    const res = await apiClient.get(`/tests/course/${courseId}`);
    return res.data.data.test ?? res.data.data;
  },

  create: async (courseId: string, payload: TestCreatePayload): Promise<Test> => {
    const res = await apiClient.post(`/tests/course/${courseId}`, payload);
    return res.data.data.test ?? res.data.data;
  },

  getResultsMeta: async (courseId: string): Promise<TestSummary> => {
    const res = await apiClient.get(`/tests/course/${courseId}/results`);
    return res.data.data.results ?? res.data.data;
  },

  // ── Тести блоків: прив'язані до конкретного уроку ───────────
  getByLesson: async (lessonId: string): Promise<Test> => {
    const res = await apiClient.get(`/tests/lesson/${lessonId}`);
    return res.data.data.test ?? res.data.data;
  },

  createForLesson: async (lessonId: string, payload: TestCreatePayload): Promise<Test> => {
    const res = await apiClient.post(`/tests/lesson/${lessonId}`, payload);
    return res.data.data.test ?? res.data.data;
  },

  updateForLesson: async (lessonId: string, payload: TestUpdatePayload): Promise<Test> => {
    const res = await apiClient.patch(`/tests/lesson/${lessonId}`, payload);
    return res.data.data.test ?? res.data.data;
  },

  deleteForLesson: async (lessonId: string): Promise<void> => {
    await apiClient.delete(`/tests/lesson/${lessonId}`);
  },

  getResultsMetaByLesson: async (lessonId: string): Promise<TestSummary | null> => {
    const res = await apiClient.get(`/tests/lesson/${lessonId}/results`);
    return res.data.data.results ?? null;
  },

  // ── Тести теми ───────────────────────────────────────────────
  getByTopic: async (topicId: string): Promise<Test> => {
    const res = await apiClient.get(`/tests/topic/${topicId}`);
    return res.data.data.test ?? res.data.data;
  },

  createForTopic: async (topicId: string, payload: TopicTestCreatePayload): Promise<Test> => {
    const res = await apiClient.post(`/tests/topic/${topicId}`, payload);
    return res.data.data.test ?? res.data.data;
  },

  updateTopicTest: async (topicId: string, payload: TestUpdatePayload): Promise<Test> => {
    const res = await apiClient.patch(`/tests/topic/${topicId}`, payload);
    return res.data.data.test ?? res.data.data;
  },

  deleteForTopic: async (topicId: string): Promise<void> => {
    await apiClient.delete(`/tests/topic/${topicId}`);
  },

  // ── Спільні для обох типів: оперують testId, не курсом/уроком ──
  update: async (testId: string, payload: TestUpdatePayload): Promise<Test> => {
    const res = await apiClient.patch(`/tests/${testId}`, payload);
    return res.data.data.test ?? res.data.data;
  },

  submit: async (testId: string, answers: number[]): Promise<TestSubmitResult> => {
    const res = await apiClient.post(`/tests/${testId}/submit`, { answers });
    return res.data.data;
  },
};
