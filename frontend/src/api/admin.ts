import { apiClient } from "./client";
import type { AdminUserListItem, Course, CourseStatus, Paginated, UserRole } from "../types";

export interface AdminUsersQuery {
  role?: UserRole;
  q?: string;
  page?: number;
  limit?: number;
}

export interface AdminCoursesQuery {
  status?: CourseStatus;
  page?: number;
  limit?: number;
}

// Адаптер: бекенд повертає { users: [], totalCount, page, totalPages }
// а фронт очікує { items: [], totalPages }
async function listUsers(query: AdminUsersQuery): Promise<Paginated<AdminUserListItem>> {
  const res = await apiClient.get("/admin/users", { params: query });
  const d = res.data.data;
  return {
    items: d.users ?? d.items ?? [],
    totalPages: d.totalPages ?? 1,
    page: d.page ?? 1,
    limit: d.limit ?? query.limit ?? 10,
    totalCount: d.totalCount ?? 0,
  };
}
async function listCourses(query: AdminCoursesQuery): Promise<Paginated<Course>> {
  const res = await apiClient.get("/admin/courses", { params: query });
  const d = res.data.data;
  return {
    items: d.courses ?? d.items ?? [],
    totalPages: d.totalPages ?? 1,
    page: d.page ?? 1,
    limit: d.limit ?? query.limit ?? 10,
    totalCount: d.totalCount ?? 0,
  };
}

export const adminApi = {
  listUsers,
  listCourses,

  changeRole: async (userId: string, role: UserRole): Promise<AdminUserListItem> => {
    const res = await apiClient.patch(`/admin/users/${userId}/role`, { role });
    return res.data.data.user;
  },

  banUser: async (userId: string): Promise<AdminUserListItem> => {
    const res = await apiClient.patch(`/admin/users/${userId}/ban`);
    return res.data.data.user;
  },

  unbanUser: async (userId: string): Promise<AdminUserListItem> => {
    const res = await apiClient.patch(`/admin/users/${userId}/unban`);
    return res.data.data.user;
  },

  unpublishCourse: async (courseId: string): Promise<Course> => {
    const res = await apiClient.patch(`/admin/courses/${courseId}/unpublish`);
    return res.data.data.course;
  },
};
