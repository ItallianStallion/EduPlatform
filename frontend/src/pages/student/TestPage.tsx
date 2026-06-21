import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { testsApi } from "../../api/tests";
import { ApiError } from "../../api/client";
import type { Test, TestSubmitResult } from "../../types";
import { Spinner, EmptyState, Card, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { getErrorMessage } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";

export function TestPage() {
  const { courseId, lessonId } = useParams<{ courseId?: string; lessonId?: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<TestSubmitResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLessonFinished, setNeedsLessonFinished] = useState(false);

  const backTarget = lessonId ? `/lessons/${lessonId}` : `/courses/${courseId}`;
  const backLabel = lessonId ? "До уроку" : "До курсу";

  useEffect(() => {
    if (!courseId && !lessonId) return;
    setIsLoading(true);
    setError(null);
    setNeedsLessonFinished(false);
    const request = lessonId ? testsApi.getByLesson(lessonId) : testsApi.getByCourse(courseId!);
    request
      .then(setTest)
      .catch((err) => {
        if (err instanceof ApiError && err.code === "LESSON_NOT_FINISHED") {
          setNeedsLessonFinished(true);
        } else {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => setIsLoading(false));
  }, [courseId, lessonId]);

  async function handleSubmit() {
    if (!test) return;
    if (Object.keys(answers).length < test.questions.length) {
      notify("Будь ласка, відповідьте на всі питання", "info");
      return;
    }
    setIsSubmitting(true);
    try {
      const orderedAnswers = test.questions.map((_, idx) => answers[idx]);
      const res = await testsApi.submit(test.id, orderedAnswers);
      setResult(res);
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <Spinner label="Завантажуємо тест…" />;

  if (needsLessonFinished) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="Тест ще не доступний"
          description="Спочатку позначте урок пройденим — тоді відкриється тест цього блоку."
          action={
            <Button variant="ghost" onClick={() => navigate(backTarget)}>
              {backLabel}
            </Button>
          }
        />
      </div>
    );
  }


  if (error || !test) return <EmptyState title="Тест не знайдено" description={error ?? undefined} />;

  if (result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center">
          {result.passed ? (
            <CheckCircle2 className="mx-auto h-12 w-12 text-teal" />
          ) : (
            <XCircle className="mx-auto h-12 w-12 text-coral" />
          )}
          <h1 className="mt-4 font-display text-2xl text-ink">
            {result.passed ? "Тест складено!" : "Тест не складено"}
          </h1>
          <p className="mt-2 font-mono text-3xl font-semibold text-ink">{result.score}%</p>
          <p className="mt-1 text-sm text-slate">
            Правильних відповідей: {result.correctCount} з {result.totalQuestions}
          </p>

          <div className="mt-8 flex flex-col gap-2 text-left">
            {result.details.map((d, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                  d.correct ? "bg-teal/5 text-teal-dark" : "bg-coral/5 text-coral-dark"
                }`}
              >
                {d.correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{d.question}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => navigate(backTarget)}>
              {backLabel}
            </Button>
            {!result.passed && test.attemptsLeft !== 0 && (
              <Button
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                Спробувати ще раз
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="gold">Прохідний бал: {test.passingScore}%</Badge>
        {typeof test.attemptsLeft === "number" && (
          <Badge tone="coral">Спроб лишилось: {test.attemptsLeft}</Badge>
        )}
      </div>
      <h1 className="mt-3 font-display text-2xl text-ink">{test.title}</h1>

      <div className="mt-6 flex flex-col gap-6">
        {test.questions.map((q, qIdx) => (
          <Card key={qIdx} className="p-5">
            <p className="font-medium text-ink">
              {qIdx + 1}. {q.question}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {q.options.map((opt, optIdx) => (
                <label
                  key={optIdx}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    answers[qIdx] === optIdx
                      ? "border-gold-dark bg-gold/10"
                      : "border-line hover:bg-ink/5"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${qIdx}`}
                    checked={answers[qIdx] === optIdx}
                    onChange={() => setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                    className="accent-gold-dark"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Button className="mt-6 w-full" onClick={handleSubmit} isLoading={isSubmitting}>
        Здати тест
      </Button>
    </div>
  );
}
