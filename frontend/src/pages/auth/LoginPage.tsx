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
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <BookOpen className="h-7 w-7 text-gold-dark" />
          <h1 className="font-display text-2xl text-ink">З поверненням</h1>
          <p className="text-sm text-slate">Увійдіть, щоб продовжити навчання чи викладання</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-dark">{error}</p>
          )}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Увійти
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate">
          Немає акаунту?{" "}
          <Link to="/register" className="font-medium text-gold-dark hover:underline">
            Зареєструватися
          </Link>
        </p>
      </div>
    </div>
  );
}
