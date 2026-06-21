import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { progressApi } from "../../api/progress";
import type { MyProgressItem } from "../../types";
import { Spinner, EmptyState, Card, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { formatPrice, getErrorMessage } from "../../utils/helpers";

export function MyCoursesPage() {
  const [items, setItems] = useState<MyProgressItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    progressApi
      .myProgress()
      .then((data) => setItems(Array.isArray(data) ? data : (data as { courses: MyProgressItem[] })?.courses ?? []))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Не вдалося завантажити курси" description={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Мої курси</h1>
      <p className="mt-1 text-sm text-slate">Курси, на які ви записані, та ваш прогрес.</p>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Ще немає курсів"
            description="Запишіться на курс з каталогу, щоб почати навчання."
            action={
              <Link to="/">
                <Button variant="ghost">Перейти до каталогу</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map(({ course, percentage, completedLessons, totalLessons }) => (
            <Card key={course.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink/5">
                  {course.coverImage ? (
                    <img src={course.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-5 w-5 text-ink/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/courses/${course.id}`} className="font-display text-lg leading-snug text-ink hover:underline">
                    {course.title}
                  </Link>
                  {course.category && <Badge>{course.category.name}</Badge>}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate">
                  <span>
                    {completedLessons}/{totalLessons} уроків
                  </span>
                  <span className="font-mono font-medium text-ink">{percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10">
                  <div
                    className="h-2 rounded-full bg-gold transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="font-mono text-xs text-slate">{formatPrice(course.price)}</span>
                <Link to={`/courses/${course.id}`}>
                  <Button size="sm" variant="ghost">
                    {percentage > 0 ? "Продовжити" : "Почати"}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
