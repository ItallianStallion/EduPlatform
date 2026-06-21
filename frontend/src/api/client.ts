import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000/api/v1";

/**
 * Бекенд видає accessToken/refreshToken як httpOnly cookies, тому JS не може
 * їх прочитати — ми просто завжди шлемо `withCredentials: true` і бекенд сам
 * читає потрібну cookie. Це сумісно і з можливим Authorization-заголовком
 * (наприклад, якщо колись знадобиться мобільний клієнт без cookie-сховища).
 */
export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export class ApiError extends Error {
  status: number;
  errors: string[];
  code?: string;

  constructor(message: string, status: number, errors: string[] = [], code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

// --- Авто-оновлення access-токена при 401 TOKEN_EXPIRED ---
// Кілька паралельних запитів не повинні викликати /refresh кожен окремо —
// чекаємо одного спільного промісу.
let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; errors?: string[]; code?: string }>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    const isAuthRoute =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register") ||
      original?.url?.includes("/auth/refresh");

    if (status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true;
      try {
        await refreshAccessToken();
        return apiClient(original);
      } catch {
        // Рефреш не вдався — сесія справді закінчилась.
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }
    }

    const message = error.response?.data?.message ?? error.message ?? "Сталася помилка";
    const errors = error.response?.data?.errors ?? [];
    throw new ApiError(message, status ?? 0, errors, code);
  },
);

