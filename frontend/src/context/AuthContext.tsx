import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, type LoginPayload, type RegisterPayload } from "../api/auth";
import { ApiError } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "eduplatform.user";

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => readCachedUser());
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    writeCachedUser(next);
  }, []);

  // Токени — httpOnly cookies, тобто JS не може перевірити їхню валідність
  // напряму. При завантаженні застосунку, якщо є кешований користувач,
  // тихо пробуємо /auth/refresh: якщо сесія все ще жива — лишаємо
  // користувача залогіненим, інакше скидаємо стан.
  useEffect(() => {
    const cached = readCachedUser();
    if (!cached) {
      setIsLoading(false);
      return;
    }
    authApi
      .refresh()
      .then(() => setUserState(cached))
      .catch(() => {
        setUserState(null);
        writeCachedUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Якщо API-шар сигналізує, що сесію не вдалось відновити навіть
  // після спроби refresh — виходимо на клієнті.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("auth:session-expired", handler);
    return () => window.removeEventListener("auth:session-expired", handler);
  }, [setUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { user: loggedInUser } = await authApi.login(payload);
      setUser(loggedInUser);
      return loggedInUser;
    },
    [setUser],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { user: registeredUser } = await authApi.register(payload);
      setUser(registeredUser);
      return registeredUser;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Навіть якщо запит на сервер не вдався, локально завжди вийдемо.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      setUser,
    }),
    [user, isLoading, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth повинен використовуватись всередині AuthProvider");
  return ctx;
}
