import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { TextField, SelectField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { getErrorMessage } from "../../utils/helpers";
import type { UserRole } from "../../types";

export function RegisterPage() {
  const { register } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    role: "student" as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const user = await register(form);
      notify(`Акаунт створено. Вітаємо, ${user.name}!`, "success");
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
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
            <h1 className="font-display text-2xl font-semibold text-ink">Створити акаунт</h1>
            <p className="mt-1 text-sm text-slate">Почніть навчатися або викладати на EduPlatform</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-paper-raised px-8 py-8 shadow-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Ім'я"
                name="name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <TextField
                label="Прізвище"
                name="surname"
                required
                minLength={2}
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            </div>
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
              autoComplete="new-password"
              required
              minLength={6}
              hint="Щонайменше 6 символів"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <SelectField
              label="Роль"
              name="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="student">Студент — навчатимусь на курсах</option>
              <option value="teacher">Викладач — створюватиму курси</option>
            </SelectField>
            {error && (
              <p className="rounded-lg bg-coral/10 px-3.5 py-2.5 text-sm text-coral-dark">{error}</p>
            )}
            <Button type="submit" isLoading={isLoading} className="w-full mt-1">
              Зареєструватися
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate">
          Вже маєте акаунт?{" "}
          <Link to="/login" className="font-semibold text-gold-dark hover:underline underline-offset-2">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  );
}
