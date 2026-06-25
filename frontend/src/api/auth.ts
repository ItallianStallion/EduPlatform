import { apiClient, refreshAccessToken } from "./client";
import type { User, UserRole } from "../types";

export interface RegisterPayload {
  name: string;
  surname: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: async (payload: RegisterPayload): Promise<{ user: User }> => {
    const res = await apiClient.post("/auth/register", payload);
    return res.data.data;
  },

  login: async (payload: LoginPayload): Promise<{ user: User }> => {
    const res = await apiClient.post("/auth/login", payload);
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  refresh: async (): Promise<void> => {
    // Делегуємо спільному дедуплікованому механізму з client.ts, щоб
    // не запускати другий незалежний /auth/refresh паралельно з тим,
    // що вже міг стартувати інтерцептор apiClient.
    await refreshAccessToken();
  },
};