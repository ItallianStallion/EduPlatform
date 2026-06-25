import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock, ArrowRight, TrendingUp, Flame } from "lucide-react";
import { progressApi } from "../../api/progress";
import type { MyProgressItem } from "../../types";
import { EmptyState, SkeletonCard } from "../../components/ui";
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

  if (error) return <EmptyState title="Не вдалося завантажити дашборд" description={error} />;

  const completed  = items?.filter((i) => i.percentage === 100) ?? [];
  const inProgress = items?.filter((i) => i.percentage > 0 && i.percentage < 100) ?? [];
  const notStarted = items?.filter((i) => i.percentage === 0) ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Вітаємо, {user?.name}! 👋
        </h1>
        <p className="mt-1.5 text-sm text-slate">Ось ваш прогрес навчання на сьогодні.</p>
      </div>

      {/* Stats */}
      {!items ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="card p-5 flex flex-col gap-3">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="skeleton h-8 w-10" />
              <div className="skeleton h-3 w-14" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={BookOpen}      label="Записано"   value={items.length}      color="text-ink"       bg="bg-ink/6" />
          <StatCard icon={Flame}         label="В процесі"  value={inProgress.length} color="text-gold-dark" bg="bg-gold/10" />
          <StatCard icon={CheckCircle2}  label="Завершено"  value={completed.length}  color="text-teal-dark" bg="bg-teal/10" />
        </div>
      )}

      {/* Course lists */}
      {!items ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Ви ще не записані на жоден курс"
          description="Перегляньте каталог і оберіть перший курс для навчання."
          action={<Link to="/catalog"><Button>Перейти до каталогу</Button></Link>}
        />
      ) : (
        <>
          {inProgress.length > 0 && (
            <Section title="Продовжити навчання" icon={TrendingUp}>
              <div className="grid gap-4 sm:grid-cols-2">
                {inProgress.map((item) => <CourseProgressCard key={item.course.id} item={item} />)}
              </div>
            </Section>
          )}
          {notStarted.length > 0 && (
            <Section title="Ще не розпочаті" icon={Clock}
              action={
                <Link to="/my-courses" className="flex items-center gap-1 text-xs font-medium text-slate hover:text-ink transition-colors">
                  Всі курси <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }>
              <div className="grid gap-4 sm:grid-cols-2">
                {notStarted.slice(0, 4).map((item) => <CourseProgressCard key={item.course.id} item={item} />)}
              </div>
            </Section>
          )}
          {completed.length > 0 && (
            <Section title="Завершені курси" icon={CheckCircle2}>
              <div className="grid gap-4 sm:grid-cols-2">
                {completed.map((item) => <CourseProgressCard key={item.course.id} item={item} />)}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate">{label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, action, children }: {
  title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate" />
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CourseProgressCard({ item }: { item: MyProgressItem }) {
  const { course, percentage, completedLessons, totalLessons } = item;
  const isDone    = percentage === 100;
  const isStarted = percentage > 0;

  return (
    <div className="card card-hover flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
          {course.coverImage
            ? <img src={course.coverImage} alt="" className="h-full w-full object-cover" />
            : <BookOpen className="h-5 w-5 text-ink/25" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink line-clamp-2 leading-snug">{course.title}</h3>
          <p className="mt-1 text-xs text-slate">
            {completedLessons} з {totalLessons} уроків · {formatPrice(course.price)}
          </p>
        </div>
        {isDone && <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-dark" />}
      </div>

      <div className="flex items-center gap-3">
        <div className="progress-bar flex-1">
          <div className={`progress-fill ${isDone ? "bg-teal" : "bg-gold"}`} style={{ width: `${percentage}%` }} />
        </div>
        <span className="w-9 text-right font-mono text-xs font-semibold text-slate tabular-nums">{percentage}%</span>
      </div>

      <Link to={`/courses/${course.id}`}
        className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
          isDone    ? "border border-teal/30 bg-teal/8 text-teal-dark hover:bg-teal/12" :
          isStarted ? "border border-gold/30 bg-gold/8 text-gold-dark hover:bg-gold/12" :
                      "border border-line bg-transparent text-ink hover:bg-ink/5"
        }`}>
        {isDone ? "Переглянути" : isStarted ? "Продовжити" : "Почати"}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
