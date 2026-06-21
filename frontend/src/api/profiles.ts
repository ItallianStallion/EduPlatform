import { apiClient } from "./client";
import type { UserProfile } from "../types";

export interface ProfileUpdatePayload {
  avatar?: string;
  bio?: string;
  phone?: string;
}

/**
 * GET /profiles/me та /profiles/:id повертають профіль ВКЛАДЕНИМ всередину
 * користувача: { data: { user: { id, name, ..., profile: { avatar, bio, phone } } } }.
 * PATCH /profiles/me натомість повертає профіль одразу плоско: { data: { profile: {...} } }.
 * Ця функція нормалізує обидва варіанти до єдиної форми UserProfile.
 */
function normalizeProfile(payload: any): UserProfile {
  const user = payload?.user;
  const profile = user?.profile ?? payload?.profile ?? payload ?? {};
  return {
    id: profile.id ?? "",
    userId: profile.userId ?? user?.id ?? "",
    avatar: profile.avatar ?? null,
    bio: profile.bio ?? null,
    phone: profile.phone ?? null,
  };
}

export const profilesApi = {
  myProfile: async (): Promise<UserProfile> => {
    const res = await apiClient.get("/profiles/me");
    return normalizeProfile(res.data.data);
  },

  updateMyProfile: async (payload: ProfileUpdatePayload): Promise<UserProfile> => {
    const res = await apiClient.patch("/profiles/me", payload);
    return normalizeProfile(res.data.data);
  },

  publicProfile: async (userId: string): Promise<UserProfile> => {
    const res = await apiClient.get(`/profiles/${userId}`);
    return normalizeProfile(res.data.data);
  },
};
