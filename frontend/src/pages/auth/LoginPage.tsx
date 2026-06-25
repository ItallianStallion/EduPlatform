import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { getErrorMessage } from "../../utils/helpers";
import { ApiError } from "../../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const user = await login(form);
      notify(`Вітаємо, ${user.name}!`, "success");
      const from = (location.state as { from?: Location })?.from?.pathname;
      navigate(from ?? "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        setError("Акаунт тимчасово заблоковано через надмірну кількість невдалих спроб входу. Спробуйте пізніше.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-paper-sunken px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink shadow-md">
            <BookOpen className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">З поверненням</h1>
            <p className="mt-1 text-sm text-slate">Увійдіть, щоб продовжити навчання</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-paper-raised px-8 py-8 shadow-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Пароль"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {error && (
              <p className="rounded-lg bg-coral/10 px-3.5 py-2.5 text-sm text-coral-dark">{error}</p>
            )}
            <Button type="submit" isLoading={isLoading} className="w-full mt-1">
              Увійти
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate">
          Ще немає акаунту?{" "}
          <Link to="/register" className="font-semibold text-gold-dark hover:underline underline-offset-2">
            Зареєструватися
          </Link>
        </p>
      </div>
    </div>
  );
}
