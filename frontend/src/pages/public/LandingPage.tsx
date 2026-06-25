import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { coursesApi } from "../../api/courses";
import { CourseCard } from "../../components/CourseCard";
import type { Course } from "../../types";
import {
  Video,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Circle,
} from "lucide-react";

const FEATURES = [
  {
    icon: Video,
    title: "Відеолекції",
    desc: "Записані лекції від викладачів. Дивіться коли зручно, стільки разів скільки потрібно.",
  },
  {
    icon: ClipboardList,
    title: "Тести та завдання",
    desc: "Онлайн-тестування з автоматичною перевіркою одразу після кожного розділу.",
  },
  {
    icon: TrendingUp,
    title: "Прогрес навчання",
    desc: "Чіткий огляд пройденого матеріалу по кожному курсу в особистому кабінеті.",
  },
];

/* ─── Декоративна картка прогресу ───────────────────────────── */
function ProgressCard() {
  const lessons = [
    { label: "Вступ до курсу", done: true },
    { label: "Основні поняття", done: true },
    { label: "Практичне завдання", done: false, active: true },
    { label: "Підсумковий тест", done: false },
  ];

  return (
    <div
      className="w-[300px] shrink-0 rounded-2xl border border-line bg-paper-raised p-5 shadow-xl shadow-ink/10"
      style={{ transform: "rotate(3deg)" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate">
            Курс · React з нуля
          </p>
          <p className="mt-1 font-display text-base font-semibold text-ink leading-snug">
            Тиждень <span className="text-gold-dark">2</span> · Компоненти
          </p>
        </div>
        <span className="rounded-full bg-paper-sunken px-2.5 py-1 font-mono text-xs font-semibold text-ink">
          62%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: "62%" }}
        />
      </div>

      {/* Lessons list */}
      <div className="flex flex-col gap-2.5">
        {lessons.map((l, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 ${l.active ? "opacity-100" : l.done ? "opacity-100" : "opacity-40"}`}
          >
            {l.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" />
            ) : l.active ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-paper font-mono text-[10px] font-bold text-gold-dark">
                {i + 1}
              </span>
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-line-strong" />
            )}
            <span
              className={`text-sm leading-tight ${
                l.active ? "font-semibold text-ink" : l.done ? "text-ink" : "text-slate"
              }`}
            >
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────── */
function CourseSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised">
      <div className="skeleton aspect-[16/9] w-full" />
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-4/5 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton mt-2 h-4 w-1/4 rounded" />
      </div>
    </div>
  );
}

/* ─── Компонент ──────────────────────────────────────────────── */
export function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  const dashboardPath =
    user?.role === "teacher" ? "/teacher" :
    user?.role === "admin"   ? "/admin"   : "/dashboard";

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) return;
    setCoursesLoading(true);
    coursesApi
      .list({ sortBy: "popular", limit: 3, page: 1 })
      .then((data) => setCourses(data.items.slice(0, 3)))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));
  }, [isAuthenticated]);

  return (
    <div className="flex flex-col">

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-paper-sunken">
        {/* Сітка */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-ink) 1px,transparent 1px),linear-gradient(90deg,var(--color-ink) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Золотий glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-5%] h-[600px] w-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle,rgba(227,163,62,0.15) 0%,transparent 70%)",
          }}
        />

        {/* Two-column layout */}
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2">

          {/* LEFT — текст */}
          <div className="flex flex-col items-start">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/8 px-3.5 py-1 font-mono text-[11px] font-medium uppercase tracking-widest text-gold-dark">
              <BookOpen className="h-3 w-3" />
              Навчальна платформа
            </span>

            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[3.2rem]">
              Знання, що{" "}
              <em className="not-italic text-gold-dark">справді залишаються</em>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-slate sm:text-lg">
              Курси від університетських викладачів. Проходьте у власному темпі,
              перевіряйте себе тестами і стежте за прогресом.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to={dashboardPath}
                  className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-md shadow-ink/15 transition-all hover:bg-ink-light active:scale-[0.97]"
                >
                  Мій кабінет <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-md shadow-ink/15 transition-all hover:bg-ink-light active:scale-[0.97]"
                  >
                    Розпочати навчання <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/catalog"
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper-raised px-6 py-3 text-sm font-semibold text-ink transition-all hover:border-ink/30 hover:shadow-sm active:scale-[0.97]"
                  >
                    Переглянути курси
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — нахилена картка */}
          <div className="hidden items-center justify-center lg:flex" style={{ perspective: "800px" }}>
            {/* Тінь-дублікат для глибини */}
            <div
              aria-hidden
              className="absolute h-[200px] w-[280px] rounded-2xl bg-ink/8 blur-2xl"
              style={{ transform: "rotate(3deg) translateY(24px)" }}
            />
            <ProgressCard />
          </div>

        </div>
      </section>

      {/* ── ПОПУЛЯРНІ КУРСИ (тільки для гостей) ─────────────── */}
      {!isAuthenticated && (
        <section className="border-t border-line bg-paper-sunken py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
                  Популярні курси
                </h2>
                <p className="mt-2 text-base text-slate">
                  Вже обирають студенти прямо зараз
                </p>
              </div>
              <Link
                to="/catalog"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-dark transition-colors hover:text-gold-dark/80"
              >
                Весь каталог <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {coursesLoading
                ? Array.from({ length: 3 }).map((_, i) => <CourseSkeleton key={i} />)
                : courses.length > 0
                  ? courses.map((c) => <CourseCard key={c.id} course={c} />)
                  : (
                    <p className="col-span-3 py-12 text-center text-sm text-slate">
                      Курси незабаром з'являться в каталозі.
                    </p>
                  )}
            </div>
          </div>
        </section>
      )}

      {/* ── МОЖЛИВОСТІ ──────────────────────────────────────── */}
      <section className="border-t border-line bg-paper py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
              Можливості платформи
            </h2>
            <p className="mt-2 text-base text-slate">
              Усе що потрібно для ефективного навчання
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-line bg-paper-sunken p-7"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-ink/6">
                  <Icon className="h-5 w-5 text-ink-muted" />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ──────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="border-t border-line bg-ink py-16 sm:py-20">
          <div className="mx-auto max-w-xl px-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-paper sm:text-3xl">
              Готові почати?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-light">
              Зареєструйтесь безкоштовно і відкрийте доступ до каталогу курсів.
            </p>
            <Link
              to="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gold px-7 py-3 text-sm font-semibold text-ink shadow-lg shadow-gold/20 transition-all hover:bg-gold-light active:scale-[0.97]"
            >
              Створити акаунт <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
