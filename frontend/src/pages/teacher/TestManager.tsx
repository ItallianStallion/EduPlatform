import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { testsApi } from "../../api/tests";
import type { Test, TestQuestion } from "../../types";
import { Spinner, EmptyState, Card, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { TextField } from "../../components/FormField";
import { getErrorMessage } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";

function blankQuestion(): TestQuestion {
  return { question: "", options: ["", ""], correctIndex: 0 };
}

export function TestManager({ courseId, isReadOnly = false }: { courseId: string; isReadOnly?: boolean }) {
  const { notify } = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [questions, setQuestions] = useState<TestQuestion[]>([blankQuestion()]);

  useEffect(() => {
    testsApi
      .getByCourse(courseId)
      .then(setTest)
      .catch(() => setTest(null))
      .finally(() => setIsLoading(false));
  }, [courseId]);

  function updateQuestion(idx: number, patch: Partial<TestQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === optIdx ? value : o)) } : q,
      ),
    );
  }

  function addOption(qIdx: number) {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ""] } : q)));
  }

  function removeOption(qIdx: number, optIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.filter((_, j) => j !== optIdx);
        const correctIndex = q.correctIndex && q.correctIndex >= options.length ? 0 : q.correctIndex;
        return { ...q, options, correctIndex };
      }),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const created = await testsApi.create(courseId, { title, questions, passingScore });
      setTest(created);
      setIsCreating(false);
      notify("Тест створено", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <Spinner />;

  if (test) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Тест курсу</h2>
          <Badge tone="gold">Прохідний бал: {test.passingScore}%</Badge>
        </div>
        <p className="mt-1 text-sm text-slate">
          API бекенду дозволяє лише один тест на курс без можливості редагування — щоб змінити питання,
          зверніться до бекенд-команди.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {test.questions.map((q, idx) => (
            <Card key={idx} className="p-4">
              <p className="font-medium text-ink">
                {idx + 1}. {q.question}
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {q.options.map((opt, optIdx) => (
                  <li
                    key={optIdx}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                      optIdx === q.correctIndex ? "bg-teal/10 text-teal-dark" : "text-ink/80"
                    }`}
                  >
                    {optIdx === q.correctIndex && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {opt}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!isCreating) {
    return (
      <EmptyState
        title="Тест ще не створено"
        description={
          isReadOnly
            ? "Викладач ще не додав тест для цього курсу."
            : "Додайте тест, щоб студенти могли перевірити знання після проходження уроків."
        }
        action={
          isReadOnly ? undefined : (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" /> Створити тест
            </Button>
          )
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Новий тест</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
          Скасувати
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_140px] gap-3">
        <TextField label="Назва тесту" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField
          label="Прохідний бал (%)"
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={(e) => setPassingScore(Number(e.target.value))}
        />
      </div>

      {questions.map((q, qIdx) => (
        <Card key={qIdx} className="p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <TextField
                label={`Питання ${qIdx + 1}`}
                required
                value={q.question}
                onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
              />
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => removeQuestion(qIdx)}
                className="mt-7 rounded p-2 text-coral-dark hover:bg-coral/5"
                aria-label="Видалити питання"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {q.options.map((opt, optIdx) => (
              <div key={optIdx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qIdx}`}
                  checked={q.correctIndex === optIdx}
                  onChange={() => updateQuestion(qIdx, { correctIndex: optIdx })}
                  title="Правильна відповідь"
                  className="accent-teal"
                />
                <input
                  required
                  value={opt}
                  onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                  placeholder={`Варіант ${optIdx + 1}`}
                  className="flex-1 rounded-md border border-line bg-paper-raised px-3 py-2 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
                />
                {q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(qIdx, optIdx)}
                    className="rounded p-1.5 text-slate hover:bg-ink/5"
                    aria-label="Видалити варіант"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(qIdx)}
              className="mt-1 self-start text-xs font-medium text-gold-dark hover:underline"
            >
              + варіант відповіді
            </button>
          </div>
        </Card>
      ))}

      <Button type="button" variant="ghost" onClick={addQuestion} className="self-start">
        <Plus className="h-4 w-4" /> Додати питання
      </Button>

      <Button type="submit" isLoading={isSaving}>
        Зберегти тест
      </Button>
    </form>
  );
}
