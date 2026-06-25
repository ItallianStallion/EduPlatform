import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { categoriesApi } from "../../api/categories";
import { adminApi } from "../../api/admin";
import type { Category, Course } from "../../types";
import { Spinner, EmptyState, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { TextField, TextAreaField, SelectField } from "../../components/FormField";
import { ConfirmDialog } from "../../components/Modal";
import { formatPrice, getErrorMessage } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { CourseContentManager } from "./CourseContentManager";
import { TestManager } from "./TestManager";

type Tab = "details" | "content" | "test";

export function CourseEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { user } = useAuth();

  // Адмін заходить на цю сторінку лише для перегляду й модерації —
  // редагувати вміст курсу можуть тільки викладач-власник.
  const isAdminView = user?.role === "admin";

  const [course, setCourse] = useState<Course | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("details");
  const [form, setForm] = useState({ title: "", description: "", categoryId: "", price: "0", coverImage: "", accessMode: "open" as "open" | "sequential" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    coursesApi
      .getById(id)
      .then((data) => {
        setCourse(data);
        setForm({
          title: data.title,
          description: data.description ?? "",
          categoryId: data.categoryId ?? "",
          price: String(data.price ?? 0),
          coverImage: data.coverImage ?? "",
          accessMode: data.accessMode ?? "open",
        });
      })
      .catch((err) => notify(getErrorMessage(err), "error"))
      .finally(() => setIsLoading(false));
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setIsSaving(true);
    try {
      const updated = await coursesApi.update(id, {
        title: form.title,
        description: form.description || undefined,
        categoryId: form.categoryId || undefined,
        price: Number(form.price) || 0,
        coverImage: form.coverImage || null,
        accessMode: form.accessMode,
      });
      setCourse(updated);
      notify("Курс оновлено", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTogglePublish() {
    if (!course) return;
    setIsToggling(true);
    try {
      const updated =
        course.status === "draft" ? await coursesApi.publish(course.id) : await coursesApi.unpublish(course.id);
      setCourse(updated);
      notify(updated.status === "published" ? "Курс опубліковано" : "Курс знято з публікації", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDeleteCourse() {
    if (!course) return;
    setIsDeleting(true);
    try {
      await coursesApi.remove(course.id);
      notify("Курс видалено", "success");
      navigate("/teacher");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  }

  async function handleAdminUnpublish() {
    if (!course) return;
    setIsToggling(true);
    try {
      const updated = await adminApi.unpublishCourse(course.id);
      setCourse(updated);
      notify("Курс знято з публікації", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsToggling(false);
    }
  }

  if (isLoading) return <Spinner />;
  if (!course) return <EmptyState title="Курс не знайдено" />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "details", label: "Деталі" },
    { key: "content", label: "Зміст курсу" },
    { key: "test", label: "Тест курсу" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-ink">{course.title}</h1>
            <Badge tone={course.status === "published" ? "teal" : "coral"}>
              {course.status === "published" ? "Опубліковано" : "Чернетка"}
            </Badge>
          </div>
          <button
            onClick={() => navigate(`/courses/${course.id}`)}
            className="mt-1 flex items-center gap-1 text-sm text-slate hover:text-ink"
          >
            Переглянути сторінку курсу <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        {isAdminView ? (
          course.status === "published" && (
            <Button variant="danger" onClick={handleAdminUnpublish} isLoading={isToggling}>
              <EyeOff className="h-4 w-4" /> Зняти з публікації
            </Button>
          )
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant={course.status === "draft" ? "teal" : "ghost"}
              onClick={handleTogglePublish}
              isLoading={isToggling}
            >
              {course.status === "draft" ? (
                <><Eye className="h-4 w-4" /> Опублікувати</>
              ) : (
                <><EyeOff className="h-4 w-4" /> Зняти з публікації</>
              )}
            </Button>
            <Button variant="danger" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Видалити курс
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-gold-dark text-ink" : "text-slate hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "details" && (
          isAdminView ? (
            <div className="flex max-w-xl flex-col gap-4">
              <ReadOnlyField label="Назва курсу" value={course.title} />
              <ReadOnlyField label="Опис" value={course.description || "—"} multiline />
              <ReadOnlyField label="Категорія" value={course.category?.name ?? "Без категорії"} />
              <ReadOnlyField label="Ціна" value={formatPrice(course.price)} />
              <ReadOnlyField label="URL обкладинки" value={course.coverImage || "—"} />
              <ReadOnlyField
                label="Режим доступу до уроків"
                value={
                  course.accessMode === "sequential"
                    ? "Послідовний — урок N доступний після N-1"
                    : "Відкритий — всі уроки доступні одразу"
                }
              />
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4">
              <TextField
                label="Назва курсу"
                required
                minLength={5}
                maxLength={255}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <TextAreaField
                label="Опис"
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <SelectField
                label="Категорія"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Без категорії</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Ціна (₴)"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <TextField
                label="URL обкладинки"
                placeholder="https://…"
                hint="Посилання на зображення (необов'язково)"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              />
              <SelectField
                label="Режим доступу до уроків"
                value={form.accessMode}
                onChange={(e) => setForm({ ...form, accessMode: e.target.value as "open" | "sequential" })}
              >
                <option value="open">Відкритий — всі уроки доступні одразу</option>
                <option value="sequential">Послідовний — урок N доступний після N-1</option>
              </SelectField>
              <Button type="submit" isLoading={isSaving} className="self-start">
                Зберегти зміни
              </Button>
            </form>
          )
        )}

        {tab === "content" && <CourseContentManager courseId={course.id} isReadOnly={isAdminView} />}

        {tab === "test" && (
          <TestManager courseId={course.id} isReadOnly={isAdminView} />
        )}
      </div>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Видалити курс?"
        description={`Курс «${course.title}» та всі його уроки, теми й прогрес студентів буде видалено назавжди. Цю дію не можна скасувати.`}
        confirmLabel="Так, видалити"
        isDanger
        isLoading={isDeleting}
        onConfirm={handleDeleteCourse}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}

// ── ReadOnlyField ──────────────────────────────────────────────
function ReadOnlyField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate">{label}</p>
      <p className={`rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink/90 ${multiline ? "whitespace-pre-line" : "truncate"}`}>
        {value}
      </p>
    </div>
  );
}
