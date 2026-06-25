import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, CheckCircle2, Pencil } from "lucide-react";
import { testsApi } from "../../api/tests";
import { ApiError } from "../../api/client";
import type { Test, TestQuestion } from "../../types";
import { Spinner, EmptyState, Card, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField } from "../../components/FormField";
import { getErrorMessage } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";

function blankQuestion(): TestQuestion {
  return { question: "", options: ["", ""], correctIndex: 0 };
}

type LessonTestMode = "view" | "create" | "edit";

/** Перегляд/створення/редагування тесту конкретного уроку (блоковий тест). */
export function LessonTestModal({
  lessonId,
  lessonTitle,
  isOpen,
  onClose,
  isReadOnly = false,
}: {
  lessonId: string;
  lessonTitle: string;
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
}) {
  const { notify } = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<LessonTestMode>("view");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState<number | "">("");
  const [questions, setQuestions] = useState<TestQuestion[]>([blankQuestion()]);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setTest(null);
    setMode("view");
    setTitle("");
    setPassingScore(70);
    setMaxAttempts("");
    setQuestions([blankQuestion()]);
    testsApi
      .getByLesson(lessonId)
      .then(setTest)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          notify(getErrorMessage(err), "error");
        }
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lessonId]);

  function enterEdit() {
    if (!test) return;
    setTitle(test.title ?? "");
    setPassingScore(test.passingScore ?? 70);
    setMaxAttempts(test.maxAttempts ?? "");
    setQuestions(test.questions.map((q) => ({ ...q, options: [...q.options] })));
    setMode("edit");
  }

  function cancelEdit() { setMode("view"); }

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

  function addQuestion() { setQuestions((prev) => [...prev, blankQuestion()]); }
  function removeQuestion(idx: number) { setQuestions((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const created = await testsApi.createForLesson(lessonId, {
        title,
        questions,
        passingScore,
        maxAttempts: maxAttempts === "" ? null : maxAttempts,
      });
      setTest(created);
      setMode("view");
      notify("Тест уроку створено", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!test) return;
    setIsSaving(true);
    try {
      const updated = await testsApi.updateForLesson(lessonId, {
        title,
        questions,
        passingScore,
        maxAttempts: maxAttempts === "" ? null : maxAttempts,
      });
      setTest(updated);
      setMode("view");
      notify("Тест уроку оновлено", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await testsApi.deleteForLesson(lessonId);
      setTest(null);
      setConfirmDelete(false);
      setMode("view");
      notify("Тест уроку видалено", "success");
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  function renderForm(isEdit: boolean) {
    return (
      <form onSubmit={isEdit ? handleUpdate : handleCreate} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
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
        <TextField
          label="Макс. спроб"
          type="number"
          min={1}
          placeholder="∞"
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(e.target.value === "" ? "" : Number(e.target.value))}
        />

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

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={cancelEdit}>
            Скасувати
          </Button>
          <Button type="submit" isLoading={isSaving} className="flex-1">
            {isEdit ? "Зберегти зміни" : "Зберегти тест"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Тест: ${lessonTitle}`}>
        {isLoading ? (
          <Spinner />
        ) : mode === "edit" ? (
          renderForm(true)
        ) : test ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold">Прохідний бал: {test.passingScore}%</Badge>
              {test.maxAttempts && <Badge tone="coral">Макс. спроб: {test.maxAttempts}</Badge>}
              {!isReadOnly && (
                <>
                  <Button variant="ghost" size="sm" onClick={enterEdit}>
                    <Pencil className="h-3.5 w-3.5" /> Редагувати
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}
                    className="text-coral-dark hover:bg-coral/8">
                    <Trash2 className="h-3.5 w-3.5" /> Видалити
                  </Button>
                </>
              )}
            </div>
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
        ) : mode === "create" ? (
          renderForm(false)
        ) : (
          <EmptyState
            title="Тест ще не створено"
            description={
              isReadOnly
                ? "Викладач ще не додав тест для цього уроку."
                : "Додайте тест для цього уроку — він відкриється студенту одразу після позначення уроку пройденим."
            }
            action={
              isReadOnly ? undefined : (
                <Button onClick={() => setMode("create")}>
                  <Plus className="h-4 w-4" /> Створити тест
                </Button>
              )
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Видалити тест уроку?"
        description="Тест буде видалено назавжди. Результати студентів також буде втрачено."
        confirmLabel="Так, видалити"
        isDanger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
