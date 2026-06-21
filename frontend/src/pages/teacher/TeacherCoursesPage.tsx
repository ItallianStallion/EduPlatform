import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { categoriesApi } from "../../api/categories";
import type { Category, Course } from "../../types";
import { Spinner, EmptyState, Card, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { TextField, TextAreaField, SelectField } from "../../components/FormField";
import { formatPrice, getErrorMessage } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";

export function TeacherCoursesPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", categoryId: "", price: "0", coverImage: "" });

  function reload() {
    coursesApi
      .myCourses()
      .then(setCourses)
      .catch((err) => notify(getErrorMessage(err), "error"));
  }

  useEffect(() => {
    reload();
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      const course = await coursesApi.create({
        title: form.title,
        description: form.description || undefined,
        categoryId: form.categoryId || undefined,
        price: Number(form.price) || 0,
        coverImage: form.coverImage || undefined,
      });
      notify("Курс створено як чернетка", "success");
      setIsModalOpen(false);
      setForm({ title: "", description: "", categoryId: "", price: "0", coverImage: "" });
      navigate(`/teacher/courses/${course.id}`);
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Мої курси</h1>
          <p className="mt-1 text-sm text-slate">Усі ваші курси, включно з чернетками.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" /> Новий курс
        </Button>
      </div>

      {!courses ? (
        <Spinner />
      ) : courses.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="У вас ще немає курсів"
            description="Створіть перший курс — він стартує як чернетка, поки ви не опублікуєте його."
            action={<Button onClick={() => setIsModalOpen(true)}>Створити курс</Button>}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <Link key={course.id} to={`/teacher/courses/${course.id}`}>
              <Card className="flex h-full flex-col gap-3 p-5 transition-shadow hover:shadow-md hover:shadow-ink/5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink/5">
                    {course.coverImage ? (
                      <img src={course.coverImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-5 w-5 text-ink/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-snug text-ink">{course.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={course.status === "published" ? "teal" : "coral"}>
                        {course.status === "published" ? "Опубліковано" : "Чернетка"}
                      </Badge>
                      {course.category && <Badge>{course.category.name}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                  <span className="font-mono text-ink">{formatPrice(course.price)}</span>
                  {typeof course.studentsCount === "number" && (
                    <span className="text-slate">{course.studentsCount} студ.</span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Новий курс">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <TextField
            label="Назва курсу"
            required
            minLength={5}
            maxLength={255}
            hint="5–255 символів"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextAreaField
            label="Опис"
            rows={4}
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
            step="1"
            hint="0 = безкоштовний курс"
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
          <Button type="submit" isLoading={isCreating} className="mt-1">
            Створити чернетку
          </Button>
        </form>
      </Modal>
    </div>
  );
}
