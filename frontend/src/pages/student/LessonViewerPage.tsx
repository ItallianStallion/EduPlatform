import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, FileQuestion } from "lucide-react";
import { lessonsApi } from "../../api/lessons";
import { topicsApi } from "../../api/topics";
import { progressApi } from "../../api/progress";
import { testsApi } from "../../api/tests";
import type { CourseProgress, Lesson, TestSummary, Topic } from "../../types";
import { ProgressThread } from "../../components/ProgressThread";
import { Spinner, EmptyState, Card } from "../../components/ui";
import { Button } from "../../components/Button";
import { getErrorMessage, toEmbedUrl } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";

export function LessonViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [testMeta, setTestMeta] = useState<TestSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    lessonsApi
      .getById(id)
      .then(async (lessonData) => {
        if (cancelled) return;
        setLesson(lessonData);
        const progress = await progressApi.courseProgress(lessonData.courseId);
        if (cancelled) return;
        setCourseProgress(progress);
        testsApi
          .getResultsMeta(lessonData.courseId)
          .then((meta) => !cancelled && setTestMeta(meta))
          .catch(() => undefined);
        topicsApi
          .listByCourse(lessonData.courseId)
          .then((t) => !cancelled && setTopics(t))
          .catch(() => undefined);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleComplete() {
    if (!lesson) return;
    setIsMarking(true);
    const nextCompleted = !isCurrentCompleted;
    try {
      await progressApi.setLessonCompleted(lesson.id, nextCompleted);
      const progress = await progressApi.courseProgress(lesson.courseId);
      setCourseProgress(progress);
      notify(nextCompleted ? "Урок позначено пройденим" : "Позначку знято", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsMarking(false);
    }
  }

  if (isLoading) return <Spinner label="Завантажуємо урок…" />;
  if (error || !lesson) return <EmptyState title="Урок не знайдено" description={error ?? undefined} />;

  const sortedLessons = courseProgress
    ? [...courseProgress.lessons].sort((a, b) => a.order - b.order)
    : [];
  const isCurrentCompleted =
    courseProgress?.lessons.find((l) => l.id === lesson.id)?.completed ?? false;
  const currentBlock = courseProgress?.blocks.find((b) => b.lesson.id === lesson.id);
  const blockTest = currentBlock?.test ?? null;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[260px_1fr]">
      <aside className="order-2 md:order-1">
        <div className="sticky top-24 rounded-lg border border-line bg-paper-raised p-4">
          {courseProgress && (
            <p className="mb-4 font-mono text-xs text-slate">
              Прогрес курсу: <span className="font-medium text-ink">{courseProgress.percentage}%</span>
            </p>
          )}
          {topics.length > 0 && lesson && (() => {
            const currentTopic = topics.find((t) => t.lessons.some((l) => l.id === lesson.id));
            if (!currentTopic) return null;
            return (
              <>
                <div className="mb-3 rounded-md bg-gold/10 px-3 py-2">
                  <p className="text-xs font-medium text-gold-dark">Поточна тема</p>
                  <p className="mt-0.5 text-sm text-ink">{currentTopic.title}</p>
                  {currentTopic.description && (
                    <p className="mt-0.5 text-xs text-slate">{currentTopic.description}</p>
                  )}
                </div>
                {currentTopic.test && (
                  <button
                    onClick={() => navigate(`/topics/${currentTopic.id}/test`)}
                    className="mb-3 flex w-full items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
                  >
                    <span className="flex items-center gap-2">
                      <FileQuestion className="h-4 w-4 text-gold-dark" /> Тест теми
                    </span>
                    {currentTopic.test && <Check className="h-4 w-4 text-slate/40" />}
                  </button>
                )}
              </>
            );
          })()}
          <ProgressThread
            items={sortedLessons.map((l) => ({
              id: l.id,
              label: l.title,
              completed: l.completed,
              active: l.id === lesson.id,
            }))}
            onSelect={(lessonId) => navigate(`/lessons/${lessonId}`)}
          />
          {blockTest && (
            <button
              onClick={() => navigate(`/lessons/${lesson.id}/test`)}
              className="mt-4 flex w-full items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
            >
              <span className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-gold-dark" /> Тест уроку
              </span>
              {blockTest.passed && <Check className="h-4 w-4 text-teal-dark" />}
            </button>
          )}
          {blockTest && !isCurrentCompleted && (
            <p className="mt-1.5 text-xs text-slate">Спочатку позначте урок пройденим, щоб відкрити тест.</p>
          )}
          {testMeta && (
            <button
              onClick={() => navigate(`/courses/${lesson.courseId}/test`)}
              className="mt-4 flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
            >
              <FileQuestion className="h-4 w-4 text-gold-dark" /> Перейти до тесту курсу
            </button>
          )}
        </div>
      </aside>

      <div className="order-1 md:order-2">
        <h1 className="font-display text-2xl text-ink">{lesson.title}</h1>

        <Card className="mt-4 overflow-hidden">
          {lesson.type === "video" && lesson.videoUrl && (
            <div className="aspect-video w-full bg-ink">
              <iframe
                src={toEmbedUrl(lesson.videoUrl)}
                title={lesson.title}
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          )}
          {lesson.type === "pdf" && lesson.pdfUrl && (
            <iframe src={lesson.pdfUrl} title={lesson.title} className="h-[70vh] w-full" />
          )}
          {lesson.type === "text" && (
            <div className="whitespace-pre-line p-6 text-[15px] leading-relaxed text-ink/90">
              {lesson.content}
            </div>
          )}
          {!lesson.videoUrl && !lesson.pdfUrl && !lesson.content && (
            <div className="p-6 text-sm text-slate">Контент цього уроку поки не додано.</div>
          )}
        </Card>

        <div className="mt-5 flex items-center justify-between">
          <Button
            variant={isCurrentCompleted ? "ghost" : "teal"}
            onClick={toggleComplete}
            isLoading={isMarking}
          >
            <Check className="h-4 w-4" />
            {isCurrentCompleted ? "Пройдено · скасувати" : "Позначити пройденим"}
          </Button>
        </div>
      </div>
    </div>
  );
}
