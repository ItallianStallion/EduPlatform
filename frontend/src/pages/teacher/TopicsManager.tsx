import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronDown, ChevronRight, CheckCircle2, FileQuestion, Pencil,
  Plus, Trash2, BookOpen, GripVertical
} from "lucide-react";
import { topicsApi } from "../../api/topics";
import { lessonsApi } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import type { Lesson, Topic } from "../../types";
import { Spinner, EmptyState, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField } from "../../components/FormField";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

// ─── TopicTestModal ───────────────────────────────────────────
function blankQuestion(): import("../../types").TestQuestion {
  return { question: "", options: ["", ""], correctIndex: 0 };
}

function TopicTestModal({
  topic,
  isOpen,
  onClose,
  isReadOnly,
}: {
  topic: Topic;
  isOpen: boolean;
  onClose: () => void;
  isReadOnly: boolean;
}) {
  const { notify } = useToast();
  const [test, setTest] = useState(topic.test ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState(`Тест теми «${topic.title}»`);
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState<number | "">("");
  const [questions, setQuestions] = useState<import("../../types").TestQuestion[]>([blankQuestion()]);

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setTest(topic.test ?? null);
    setIsCreating(false);
    setTitle(`Тест теми «${topic.title}»`);
    setPassingScore(70);
    setMaxAttempts("");
    setQuestions([blankQuestion()]);
  }, [isOpen, topic]);

  function updateQuestion(idx: number, patch: Partial<import("../../types").TestQuestion>) {
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
      const created = await testsApi.createForTopic(topic.id, {
        title,
        questions,
        passingScore,
        maxAttempts: maxAttempts === "" ? null : maxAttempts,
      });
      setTest(created as never);
      setIsCreating(false);
      notify("Тест теми створено", "success");
      onClose();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Тест теми «${topic.title}»`}>
      {test ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">Прохідний бал: {test.passingScore}%</Badge>
            {test.maxAttempts && <Badge tone="coral">Макс. спроб: {test.maxAttempts}</Badge>}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {test.questions.map((q: import("../../types").TestQuestion, idx: number) => (
              <div key={idx} className="rounded-lg border border-line bg-paper-raised p-4">
                <p className="font-medium text-ink">
                  {idx + 1}. {q.question}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {q.options.map((opt: string, optIdx: number) => (
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
              </div>
            ))}
          </div>
        </div>
      ) : isReadOnly ? (
        <p className="text-sm text-slate">Тест не додано.</p>
      ) : !isCreating ? (
        <EmptyState
          title="Тест ще не створено"
          description="Додайте тест для цієї теми — він відкриється студенту після завершення уроків теми."
          action={
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" /> Створити тест
            </Button>
          }
        />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
            <div key={qIdx} className="rounded-lg border border-line bg-paper-raised p-4">
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
                      name={`correct-topic-${qIdx}`}
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
            </div>
          ))}

          <Button type="button" variant="ghost" onClick={addQuestion} className="self-start">
            <Plus className="h-4 w-4" /> Додати питання
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
              Скасувати
            </Button>
            <Button type="submit" isLoading={isSaving} className="flex-1">
              Зберегти тест
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─── AssignLessonsModal ───────────────────────────────────────
function AssignLessonsModal({
  topic,
  allLessons,
  assignedToOtherTopics,
  isOpen,
  onClose,
  onSaved,
}: {
  topic: Topic;
  allLessons: Lesson[];
  assignedToOtherTopics: Set<string>;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const assignedIds = new Set(topic.lessons.map((l) => l.id));
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [isSaving, setIsSaving] = useState(false);

  // Показуємо урок якщо він вже в цій темі (можна зняти) або ще не в жодній темі
  const available = allLessons.filter((l) =>
    assignedIds.has(l.id) || !assignedToOtherTopics.has(l.id)
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await topicsApi.assignLessons(topic.id, [...selected]);
      notify("Уроки призначено", "success");
      onSaved();
      onClose();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Уроки теми «${topic.title}»`}>
      <div className="flex flex-col gap-3">
        {available.length === 0 ? (
          <p className="text-sm text-slate">Всі уроки вже призначені до інших тем.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {available.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  id={`lesson-${l.id}`}
                  className="accent-gold-dark"
                />
                <label htmlFor={`lesson-${l.id}`} className="flex-1 cursor-pointer text-sm text-ink">
                  {l.title}
                </label>
                <Badge>{LESSON_TYPE_LABELS[l.type]}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={handleSave} isLoading={isSaving} disabled={available.length === 0}>
          Зберегти
        </Button>
      </div>
    </Modal>
  );
}

// ─── TopicsManager ────────────────────────────────────────────
export function TopicsManager({ courseId, isReadOnly = false }: { courseId: string; isReadOnly?: boolean }) {
  const { notify } = useToast();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modals
  const [topicModal, setTopicModal] = useState<{ open: boolean; editing: Topic | null }>({ open: false, editing: null });
  const [topicForm, setTopicForm] = useState({ title: "", description: "" });
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testTopic, setTestTopic] = useState<Topic | null>(null);
  const [assignTopic, setAssignTopic] = useState<Topic | null>(null);
  const [lessonTestLesson, setLessonTestLesson] = useState<Lesson | null>(null);

  function reload() {
    Promise.all([
      topicsApi.listByCourse(courseId),
      lessonsApi.listByCourse(courseId),
    ])
      .then(([t, l]) => {
        setTopics(t);
        setAllLessons(l);
        // Розгортаємо всі теми за замовчуванням
        setExpanded(new Set(t.map((tp) => tp.id)));
      })
      .catch((err) => notify(getErrorMessage(err), "error"));
  }

  useEffect(reload, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openCreateTopic() {
    setTopicForm({ title: "", description: "" });
    setTopicModal({ open: true, editing: null });
  }

  function openEditTopic(topic: Topic) {
    setTopicForm({ title: topic.title, description: topic.description ?? "" });
    setTopicModal({ open: true, editing: topic });
  }

  async function handleTopicSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSavingTopic(true);
    try {
      if (topicModal.editing) {
        await topicsApi.update(topicModal.editing.id, {
          title: topicForm.title,
          description: topicForm.description || null,
        });
        notify("Тему оновлено", "success");
      } else {
        await topicsApi.create(courseId, {
          title: topicForm.title,
          description: topicForm.description || null,
        });
        notify("Тему додано", "success");
      }
      setTopicModal({ open: false, editing: null });
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSavingTopic(false);
    }
  }

  async function handleDeleteTopic() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await topicsApi.remove(pendingDelete.id);
      notify("Тему видалено. Уроки збережено.", "success");
      setPendingDelete(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  if (!topics) return <Spinner />;

  // Уроки без теми — визначаємо через список id уроків що вже є в темах
  const assignedLessonIds = new Set(topics.flatMap((t) => t.lessons.map((l) => l.id)));
  const unassigned = allLessons.filter((l) => !assignedLessonIds.has(l.id));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Теми курсу</h2>
        {!isReadOnly && (
          <Button size="sm" onClick={openCreateTopic}>
            <Plus className="h-4 w-4" /> Додати тему
          </Button>
        )}
      </div>

      {topics.length === 0 && (
        <EmptyState
          title="Тем ще немає"
          description="Додайте першу тему щоб згрупувати уроки курсу."
        />
      )}

      {/* Topics list */}
      {topics.map((topic) => (
        <div key={topic.id} className="rounded-lg border border-line bg-paper-raised">
          {/* Topic header */}
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              onClick={() => toggleExpand(topic.id)}
              className="shrink-0 text-slate hover:text-ink"
            >
              {expanded.has(topic.id)
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />
              }
            </button>
            <GripVertical className="h-4 w-4 shrink-0 text-slate/40" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-ink truncate">{topic.title}</h3>
              {topic.description && (
                <p className="text-xs text-slate truncate">{topic.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate">
                {topic.lessons.length} {topic.lessons.length === 1 ? "урок" : "уроків"}
              </span>
              {topic.test && (
                <Badge tone="gold">Тест</Badge>
              )}
              {!isReadOnly && (
                <>
                  <button
                    onClick={() => setAssignTopic(topic)}
                    title="Призначити уроки"
                    className="rounded p-1.5 text-slate hover:bg-ink/5"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setTestTopic(topic)}
                    title="Тест теми"
                    className="rounded p-1.5 text-slate hover:bg-ink/5"
                  >
                    <FileQuestion className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openEditTopic(topic)}
                    title="Редагувати"
                    className="rounded p-1.5 text-slate hover:bg-ink/5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(topic)}
                    title="Видалити"
                    className="rounded p-1.5 text-coral-dark hover:bg-coral/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Lessons in topic */}
          {expanded.has(topic.id) && (
            <div className="border-t border-line">
              {topic.lessons.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate italic">
                  Уроків у темі немає.{!isReadOnly && " Натисніть іконку книги щоб додати."}
                </p>
              ) : (
                <ol className="divide-y divide-line">
                  {[...topic.lessons]
                    .sort((a, b) => a.order - b.order)
                    .map((lesson, idx) => (
                      <li key={lesson.id} className="flex items-center gap-3 px-6 py-2.5">
                        <span className="font-mono text-xs text-slate/60">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 truncate text-sm text-ink">{lesson.title}</span>
                        <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
                        <button
                          onClick={() => setLessonTestLesson(lesson)}
                          title="Тест уроку"
                          className="rounded p-1.5 text-slate hover:bg-ink/5"
                        >
                          <FileQuestion className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Unassigned lessons */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border border-dashed border-line bg-paper p-4">
          <p className="mb-2 text-xs font-medium text-slate">
            Уроки без теми ({unassigned.length})
          </p>
          <ol className="flex flex-col gap-1">
            {unassigned.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm text-ink/70">
                <span className="truncate">{l.title}</span>
                <Badge>{LESSON_TYPE_LABELS[l.type]}</Badge>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Topic create/edit modal */}
      <Modal
        isOpen={topicModal.open}
        onClose={() => setTopicModal({ open: false, editing: null })}
        title={topicModal.editing ? "Редагувати тему" : "Нова тема"}
      >
        <form onSubmit={handleTopicSubmit} className="flex flex-col gap-4">
          <TextField
            label="Назва теми"
            required
            minLength={2}
            maxLength={255}
            value={topicForm.title}
            onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
          />
          <TextAreaField
            label="Опис теми (необов'язково)"
            rows={3}
            value={topicForm.description}
            onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
          />
          <Button type="submit" isLoading={isSavingTopic}>
            {topicModal.editing ? "Зберегти зміни" : "Додати тему"}
          </Button>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Видалити тему?"
        description={`Тема «${pendingDelete?.title}» буде видалена. Уроки залишаться в курсі без теми.`}
        confirmLabel="Видалити"
        isDanger
        isLoading={isDeleting}
        onConfirm={handleDeleteTopic}
        onCancel={() => setPendingDelete(null)}
      />

      {/* Topic test modal */}
      {testTopic && (
        <TopicTestModal
          topic={testTopic}
          isOpen={!!testTopic}
          onClose={() => { setTestTopic(null); reload(); }}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Assign lessons modal */}
      {assignTopic && (
        <AssignLessonsModal
          topic={assignTopic}
          allLessons={allLessons}
          assignedToOtherTopics={new Set(
            topics
              .filter((t) => t.id !== assignTopic.id)
              .flatMap((t) => t.lessons.map((l) => l.id))
          )}
          isOpen={!!assignTopic}
          onClose={() => setAssignTopic(null)}
          onSaved={reload}
        />
      )}

      {/* Lesson test modal */}
      {lessonTestLesson && (
        <LessonTestModal
          lessonId={lessonTestLesson.id}
          lessonTitle={lessonTestLesson.title}
          isOpen={!!lessonTestLesson}
          onClose={() => setLessonTestLesson(null)}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
