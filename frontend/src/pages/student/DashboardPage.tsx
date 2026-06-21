import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { progressApi } from "../../api/progress";
import type { MyProgressItem } from "../../types";
import { Spinner, EmptyState, Card } from "../../components/ui";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { formatPrice, getErrorMessage } from "../../utils/helpers";

export function DashboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MyProgressItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    progressApi
      .myProgress()
      .then((data) => setItems(Array.isArray(data) ? data : (data as { courses: MyProgressItem[] })?.courses ?? []))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const completed  = items?.filter((i) => i.percentage === 100) ?? [];
  const inProgress = items?.filter((i) => i.percentage > 0 && i.percentage < 100) ?? [];
  const notStarted = items?.filter((i) => i.percentage === 0) ?? [];

  if (error) return <EmptyState title="Не вдалося завантажити дашборд" description={error} />;
  if (!items) return <Spinner />;

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          Вітаємо, {user?.name}! 👋
        </h1>
        <p className="mt-1 text-sm text-slate">
          Ось ваш прогрес навчання на сьогодні.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="flex flex-col gap-1 p-5">
          <div className="flex items-center gap-2 text-slate">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs">Записано</span>
          </div>
          <div className="font-display text-3xl font-semibold text-ink">{items.length}</div>
          <div className="text-xs text-slate">курсів</div>
        </Card>

        <Card className="flex flex-col gap-1 p-5">
          <div className="flex items-center gap-2 text-slate">
            <Clock className="h-4 w-4" />
            <span className="text-xs">В процесі</span>
          </div>
          <div className="font-display text-3xl font-semibold text-gold-dark">
            {inProgress.length}
          </div>
          <div className="text-xs text-slate">курсів</div>
        </Card>

        <Card className="flex flex-col gap-1 p-5">
          <div className="flex items-center gap-2 text-slate">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Завершено</span>
          </div>
          <div className="font-display text-3xl font-semibold text-teal-dark">
            {completed.length}
          </div>
          <div className="text-xs text-slate">курсів</div>
        </Card>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Ви ще не записані на жоден курс"
          description="Перегляньте каталог і оберіть перший курс для навчання."
          action={
            <Link to="/">
              <Button variant="ghost">Перейти до каталогу</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* In progress */}
          {inProgress.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Продовжити навчання</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {inProgress.map((item) => (
                  <CourseProgressCard key={item.course.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Not started */}
          {notStarted.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Ще не розпочаті</h2>
                <Link to="/my-courses" className="flex items-center gap-1 text-xs text-slate hover:text-ink">
                  Всі курси <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {notStarted.slice(0, 4).map((item) => (
                  <CourseProgressCard key={item.course.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold text-ink">Завершені курси</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {completed.map((item) => (
                  <CourseProgressCard key={item.course.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── CourseProgressCard ─────────────────────────────────────────
function CourseProgressCard({ item }: { item: MyProgressItem }) {
  const { course, percentage, completedLessons, totalLessons } = item;
  const isDone = percentage === 100;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        {/* Cover / icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink/5">
          {course.coverImage ? (
            <img src={course.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="h-5 w-5 text-ink/30" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink">{course.title}</h3>
          <p className="mt-0.5 text-xs text-slate">
            {completedLessons} з {totalLessons} уроків
            {" · "}
            {formatPrice(course.price)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full transition-all ${isDone ? "bg-teal" : "bg-gold"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs font-medium text-slate">{percentage}%</span>
      </div>

      {/* Action */}
      <Link
        to={`/courses/${course.id}`}
        className="flex items-center justify-center gap-2 rounded-md border border-line py-2 text-xs font-medium text-ink transition-colors hover:bg-ink/5"
      >
        {isDone ? "Переглянути" : percentage === 0 ? "Почати" : "Продовжити"}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
