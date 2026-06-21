import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Lock, FileText, PlayCircle, FileQuestion, Pencil, Eye, CheckCircle2 } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { lessonsApi } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import { ApiError } from "../../api/client";
import type { Course, CourseBlock, TestSummary } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Spinner, Badge, EmptyState } from "../../components/ui";
import { Button } from "../../components/Button";
import { formatPrice, getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";

const LESSON_ICONS = { video: PlayCircle, text: FileText, pdf: FileText };

export function CourseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<CourseBlock[]>([]);
  const [legacyTestMeta, setLegacyTestMeta] = useState<TestSummary | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const isOwner = user && course && (user.id === course.teacherId || user.role === "admin");
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const courseData = await coursesApi.getById(id!);
        if (cancelled) return;
        setCourse(courseData);

        try {
          const blocksData = await lessonsApi.getBlocks(id!);
          if (cancelled) return;
          setBlocks(blocksData);
          setHasAccess(true);
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            setHasAccess(false);
          } else if (!(err instanceof ApiError && err.status === 401)) {
            throw err;
          }
        }

        // Legacy курсовий тест (один на весь курс) — окремо від блокових тестів.
        try {
          const meta = await testsApi.getResultsMeta(id!);
          if (!cancelled) setLegacyTestMeta(meta);
        } catch {
          // тесту може не існувати — це нормально
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleEnroll() {
    if (!id) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/courses/${id}` } } });
      return;
    }
    setIsEnrolling(true);
    try {
      await coursesApi.enroll(id);
      notify("Ви записались на курс!", "success");
      const blocksData = await lessonsApi.getBlocks(id);
      setBlocks(blocksData);
      setHasAccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_ENROLLED") {
        notify("Ви вже записані на цей курс.", "info");
        setHasAccess(true);
      } else {
        notify(getErrorMessage(err), "error");
      }
    } finally {
      setIsEnrolling(false);
    }
  }

  if (isLoading) return <Spinner label="Завантажуємо курс…" />;
  if (error || !course)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Курс не знайдено" description={error ?? undefined} />
      </div>
    );

  const isFree = !course.price || Number(course.price) === 0;
  const sortedBlocks = blocks.slice().sort((a, b) => a.lesson.order - b.lesson.order);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {course.category && <Badge>{course.category.name}</Badge>}
        {course.status === "draft" && <Badge tone="coral">Чернетка</Badge>}
      </div>
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{course.title}</h1>
      {course.teacher && (
        <p className="mt-2 text-sm text-slate">
          Викладач:{" "}
          <Link to={`/teachers/${course.teacherId}`} className="font-medium text-ink hover:underline">
            {course.teacher.name} {course.teacher.surname}
          </Link>
        </p>
      )}

      <div className="my-6 overflow-hidden rounded-lg bg-ink/5">
        {course.coverImage ? (
          <img src={course.coverImage} alt={course.title} className="aspect-[16/7] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/7] items-center justify-center">
            <BookOpen className="h-12 w-12 text-ink/20" />
          </div>
        )}
      </div>

      <div className="grid gap-8 sm:grid-cols-[1fr_280px]">
        <div className="order-2 sm:order-1">
          {course.description && (
            <div className="prose-sm mb-8 whitespace-pre-line text-ink/90">{course.description}</div>
          )}

          <h2 className="mb-3 font-display text-xl text-ink">Програма курсу</h2>
          {!hasAccess && !isOwner && (
            <p className="mb-3 flex items-center gap-2 rounded-md bg-ink/5 px-3 py-2 text-sm text-slate">
              <Lock className="h-4 w-4" /> Запишіться на курс, щоб відкрити уроки
            </p>
          )}
          {sortedBlocks.length === 0 ? (
            <EmptyState title="Уроки ще не додані" description="Викладач поки не опублікував матеріали." />
          ) : (
            <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-paper-raised">
              {sortedBlocks.map(({ lesson, test }, idx) => {
                const Icon = LESSON_ICONS[lesson.type] ?? FileText;
                return (
                  <li key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="font-mono text-xs text-slate">{String(idx + 1).padStart(2, "0")}</span>
                    {lesson.locked ? (
                      <Lock className="h-4 w-4 text-slate/50" />
                    ) : (
                      <Icon className="h-4 w-4 text-slate" />
                    )}
                    <span className={`flex-1 text-sm ${lesson.locked ? "text-slate/60" : "text-ink"}`}>
                      {lesson.title}
                    </span>
                    {test && (
                      <span
                        className="flex items-center gap-1 text-xs text-slate"
                        title={`Тест блоку: ${test.title}`}
                      >
                        <FileQuestion className="h-3.5 w-3.5 text-gold-dark" />
                        {test.passed && <CheckCircle2 className="h-3.5 w-3.5 text-teal-dark" />}
                      </span>
                    )}
                    <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
                  </li>
                );
              })}
            </ol>
          )}

          {legacyTestMeta && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-line bg-paper-raised px-4 py-3">
              <FileQuestion className="h-5 w-5 text-gold-dark" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-ink">{legacyTestMeta.title}</p>
                <p className="text-slate">
                  {legacyTestMeta.questionsCount} питань · прохідний бал {legacyTestMeta.passingScore}%
                </p>
              </div>
              {hasAccess && (
                <Button size="sm" variant="ghost" onClick={() => navigate(`/courses/${course.id}/test`)}>
                  До тесту
                </Button>
              )}
            </div>
          )}
        </div>

        <aside className="order-1 sm:order-2">
          <div className="sticky top-24 rounded-lg border border-line bg-paper-raised p-5">
            <p className={`font-mono text-2xl font-semibold ${isFree ? "text-teal-dark" : "text-ink"}`}>
              {formatPrice(course.price)}
            </p>
            {isOwner ? (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => navigate(`/teacher/courses/${course.id}`)}
              >
                {isAdmin ? (
                  <>
                    <Eye className="h-4 w-4" /> Переглянути курс
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" /> Редагувати курс
                  </>
                )}
              </Button>
            ) : hasAccess ? (
              <Button
                className="mt-4 w-full"
                onClick={() => sortedBlocks[0] && navigate(`/lessons/${sortedBlocks[0].lesson.id}`)}
                disabled={sortedBlocks.length === 0}
              >
                Продовжити навчання
              </Button>
            ) : (
              <Button
                className="mt-4 w-full"
                onClick={handleEnroll}
                isLoading={isEnrolling}
              >
                {isFree ? "Записатися безкоштовно" : "Записатися на курс"}
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
