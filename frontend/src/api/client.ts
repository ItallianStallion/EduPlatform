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

// --- Авто-оновлення access-токена при 401 ---
// ЄДИНА точка входу для рефрешу в усьому застосунку: і інтерцептор нижче,
// і AuthContext (перевірка сесії при старті) повинні викликати САМЕ цю
// функцію, а не ходити на /auth/refresh напряму через apiClient/authApi.
// Інакше два незалежні refresh-запити можуть полетіти одночасно з тим самим
// ще-валідним cookie-токеном: перший його ротує на бекенді, другий
// долітає вже зі застарілим токеном і отримує 401 → користувача розлогінює,
// хоча сесія насправді жива.
let refreshPromise: Promise<void> | null = null;

export async function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .catch((err: AxiosError<{ message?: string; errors?: string[]; code?: string }>) => {
        // Нормалізуємо помилку до ApiError, щоб усі викликачі (AuthContext,
        // інтерцептор нижче) могли однаково перевірити err.status — цей
        // запит іде напряму через axios, а не через apiClient, тому
        // звичайний інтерцептор apiClient тут не застосовується.
        const status = err.response?.status ?? 0;
        const message = err.response?.data?.message ?? err.message ?? "Сталася помилка";
        const errors = err.response?.data?.errors ?? [];
        const code = err.response?.data?.code;
        throw new ApiError(message, status, errors, code);
      })
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

