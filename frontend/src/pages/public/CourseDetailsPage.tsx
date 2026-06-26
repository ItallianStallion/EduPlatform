import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookOpen, Lock, FileText, PlayCircle, FileQuestion,
  Pencil, Eye, CheckCircle2, ChevronDown, ChevronRight,
} from "lucide-react";
import { coursesApi } from "../../api/courses";
import { lessonsApi } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import { topicsApi } from "../../api/topics";
import { ApiError } from "../../api/client";
import type { Course, CourseBlock, TestSummary, Topic } from "../../types";
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
  const [topics, setTopics] = useState<Topic[]>([]);
  const [legacyTestMeta, setLegacyTestMeta] = useState<TestSummary | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  // Які теми розкриті (за замовчуванням — усі)
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const isOwner = user && course && (user.id === course.teacherId || user.role === "admin");
  const isAdmin = user?.role === "admin";

  const loadCourseData = useCallback(async (courseId: string) => {
    const courseData = await coursesApi.getById(courseId);
    setCourse(courseData);

    const isPaid = courseData.price && Number(courseData.price) > 0;
    const isOwnerOrAdmin = user && (user.id === courseData.teacherId || user.role === "admin");

    let accessGranted = false;
    try {
      const { blocks: blocksData, enrolled } = await lessonsApi.getBlocks(courseId);
      setBlocks(blocksData);
      // Доступ до контенту визначається явним прапорцем `enrolled` з бекенду
      // (записаний / власник / admin), а не тим, чи вдалося завантажити
      // структуру курсу — структуру (preview) бачать усі, незалежно від запису.
      accessGranted = enrolled || !!isOwnerOrAdmin || !!courseData.isEnrolled;
      setHasAccess(accessGranted);
      setAccessDenied(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setHasAccess(false);
        // Для платного курсу без доступу — показуємо замок
        // Для безкоштовного — НЕ показуємо замок (бекенд просто вимагає входу для блоків,
        // але контент буде доступний після запису — тому показуємо лише кнопку "Записатись")
        setAccessDenied(!!isPaid && !isOwnerOrAdmin);
      } else {
        throw err;
      }
    }

    // Завантажуємо теми:
    // - власник/адмін: завжди
    // - enrolled студент (accessGranted): завжди  
    // - незалогінений/не записаний на БЕЗКОШТОВНИЙ курс: теж пробуємо (для preview)
    const shouldLoadTopics = accessGranted || isOwnerOrAdmin || !isPaid;
    if (shouldLoadTopics) {
      try {
        const topicsData = await topicsApi.listByCourse(courseId);
        setTopics(topicsData);
        setExpandedTopics(new Set(topicsData.map((t) => t.id)));
      } catch {
        // теми недоступні — нічого страшного
      }
    }

    try {
      const meta = await testsApi.getResultsMeta(courseId);
      setLegacyTestMeta(meta);
    } catch {
      // тесту може не існувати
    }
  }, [user]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loadCourseData(id)
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [id, loadCourseData]);

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
      await loadCourseData(id);
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

  function toggleTopic(topicId: string) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) { next.delete(topicId); } else { next.add(topicId); }
      return next;
    });
  }

  if (isLoading) return <Spinner label="Завантажуємо курс…" />;
  if (error || !course)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Курс не знайдено" description={error ?? undefined} />
      </div>
    );

  const isFree = !course.price || Number(course.price) === 0;

  // Уроки без теми (не прив'язані до жодної теми)
  const topicLessonIds = new Set(topics.flatMap((t) => t.lessons.map((l) => l.id)));
  const ungroupedBlocks = blocks
    .filter((b) => !topicLessonIds.has(b.lesson.id))
    .slice()
    .sort((a, b) => a.lesson.order - b.lesson.order);

  // Блоки по темах (для пошуку тесту блоку)
  const blockByLessonId = new Map(blocks.map((b) => [b.lesson.id, b]));

  const hasCurriculum = topics.length > 0 || blocks.length > 0;
  // Перший доступний урок для кнопки "Продовжити"
  const firstLesson = topics.length > 0
    ? topics[0]?.lessons?.[0]
    : blocks[0]?.lesson;

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

          {/* Для безкоштовного незаписаного — м'яка підказка без замку */}
          {!hasAccess && !isOwner && isFree && !accessDenied && (
            <p className="mb-3 flex items-center gap-2 rounded-md bg-ink/5 px-3 py-2 text-sm text-slate">
              <Lock className="h-4 w-4" /> Запишіться на курс, щоб відкрити уроки
            </p>
          )}

          {/* Платний курс без доступу — великий блок із замком */}
          {accessDenied && !isOwner ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-paper-raised px-6 py-10 text-center">
              <Lock className="h-8 w-8 text-slate/40" />
              <p className="font-medium text-ink">Доступ до матеріалів закрито</p>
              <p className="text-sm text-slate">
                Придбайте курс, щоб отримати доступ до всіх матеріалів.
              </p>
            </div>
          ) : !hasCurriculum ? (
            <EmptyState title="Уроки ще не додані" description="Викладач поки не опублікував матеріали." />
          ) : (
            <div className="flex flex-col gap-3">

              {/* ── Теми з уроками ── */}
              {topics.map((topic) => {
                const isExpanded = expandedTopics.has(topic.id);
                const sortedLessons = topic.lessons.slice().sort((a, b) => a.order - b.order);

                return (
                  <div key={topic.id} className="overflow-hidden rounded-lg border border-line bg-paper-raised">
                    {/* Заголовок теми */}
                    <button
                      onClick={() => toggleTopic(topic.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink/5 transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 shrink-0 text-slate" />
                        : <ChevronRight className="h-4 w-4 shrink-0 text-slate" />
                      }
                      <span className="flex-1 font-medium text-ink">{topic.title}</span>
                      <span className="text-xs text-slate shrink-0">
                        {sortedLessons.length} {sortedLessons.length === 1 ? "урок" : "уроків"}
                        {topic.test ? " · тест" : ""}
                      </span>
                    </button>

                    {/* Уроки теми */}
                    {isExpanded && (
                      <ol className="flex flex-col divide-y divide-line border-t border-line">
                        {sortedLessons.length === 0 ? (
                          <li className="px-10 py-3 text-sm text-slate/60">Уроків ще немає</li>
                        ) : (
                          sortedLessons.map((lesson, idx) => {
                            const Icon = LESSON_ICONS[lesson.type] ?? FileText;
                            const block = blockByLessonId.get(lesson.id);
                            return (
                              <li key={lesson.id} className="flex items-center gap-3 px-4 py-3 pl-11">
                                <span className="font-mono text-xs text-slate">
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                {lesson.locked ? (
                                  <Lock className="h-4 w-4 text-slate/50" />
                                ) : (
                                  <Icon className="h-4 w-4 text-slate" />
                                )}
                                <span className={`flex-1 text-sm ${lesson.locked ? "text-slate/60" : "text-ink"}`}>
                                  {lesson.title}
                                </span>
                                {block?.test && (
                                  <span className="flex items-center gap-1 text-xs text-slate" title={`Тест: ${block.test.title}`}>
                                    <FileQuestion className="h-3.5 w-3.5 text-gold-dark" />
                                    {block.test.passed && <CheckCircle2 className="h-3.5 w-3.5 text-teal-dark" />}
                                  </span>
                                )}
                                <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
                              </li>
                            );
                          })
                        )}

                        {/* Тест теми */}
                        {topic.test && (
                          <li className="flex items-center gap-3 border-t border-line bg-gold/5 px-4 py-3 pl-11">
                            <FileQuestion className="h-4 w-4 text-gold-dark" />
                            <div className="flex-1 text-sm">
                              <span className="font-medium text-ink">{topic.test.title}</span>
                              <span className="ml-2 text-xs text-slate">
                                прохідний бал {topic.test.passingScore}%
                              </span>
                            </div>
                            {hasAccess && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/topics/${topic.id}/test`)}
                              >
                                До тесту
                              </Button>
                            )}
                          </li>
                        )}
                      </ol>
                    )}
                  </div>
                );
              })}

              {/* ── Уроки без теми (старий формат або не розподілені) ── */}
              {ungroupedBlocks.length > 0 && (
                <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-paper-raised">
                  {ungroupedBlocks.map(({ lesson, test }, idx) => {
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
                          <span className="flex items-center gap-1 text-xs text-slate" title={`Тест: ${test.title}`}>
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
            </div>
          )}

          {/* Legacy тест курсу */}
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
                  <><Eye className="h-4 w-4" /> Переглянути курс</>
                ) : (
                  <><Pencil className="h-4 w-4" /> Редагувати курс</>
                )}
              </Button>
            ) : hasAccess ? (
              <Button
                className="mt-4 w-full"
                onClick={() => firstLesson && navigate(`/lessons/${firstLesson.id}`)}
                disabled={!firstLesson}
              >
                Продовжити навчання
              </Button>
            ) : (
              <Button className="mt-4 w-full" onClick={handleEnroll} isLoading={isEnrolling}>
                {isFree ? "Записатися безкоштовно" : "Записатися на курс"}
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
