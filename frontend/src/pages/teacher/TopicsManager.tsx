import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronDown, ChevronRight, FileQuestion, Pencil,
  Plus, Trash2, BookOpen, GripVertical
} from "lucide-react";
import { topicsApi } from "../../api/topics";
import { lessonsApi } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import type { Lesson, Topic } from "../../types";
import { Spinner, EmptyState, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField, SelectField } from "../../components/FormField";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

// ─── TopicTestModal ───────────────────────────────────────────
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
  const [test, setTest] = useState(topic.test);
  const [form, setForm] = useState({
    title: topic.test?.title ?? `Тест теми «${topic.title}»`,
    passingScore: topic.test?.passingScore ?? 70,
    maxAttempts: topic.test?.maxAttempts ?? ("" as number | ""),
    questions: topic.test ? JSON.stringify(topic.test, null, 2) : "[]",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      let parsed: unknown[];
      try { parsed = JSON.parse(form.questions); }
      catch { notify("Невірний JSON питань", "error"); setIsSaving(false); return; }

      const created = await testsApi.createForTopic(topic.id, {
        title: form.title,
        passingScore: form.passingScore,
        maxAttempts: form.maxAttempts === "" ? null : Number(form.maxAttempts),
        questions: parsed as never,
      });
      setTest(created as never);
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
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate">Тест вже існує для цієї теми.</p>
          <div className="rounded-md border border-line bg-paper-raised p-3 text-sm">
            <p className="font-medium text-ink">{test.title}</p>
            <p className="mt-1 text-xs text-slate">
              Прохідний бал: {test.passingScore}% ·{" "}
              {test.maxAttempts ? `Спроб: ${test.maxAttempts}` : "Необмежено спроб"}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>Закрити</Button>
        </div>
      ) : isReadOnly ? (
        <p className="text-sm text-slate">Тест не додано.</p>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <p className="rounded-md bg-ink/5 px-3 py-2 text-xs text-slate">
            Питання вводяться як JSON-масив:{" "}
            <code className="text-ink">[{"{"}"question":"...","options":["A","B"],"correctIndex":0{"}"}]</code>
          </p>
          <TextField
            label="Назва тесту"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Прохідний бал (%)"
              type="number"
              min={0}
              max={100}
              value={form.passingScore}
              onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })}
            />
            <TextField
              label="Макс. спроб"
              type="number"
              min={1}
              placeholder="∞"
              value={form.maxAttempts}
              onChange={(e) => setForm({ ...form, maxAttempts: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </div>
          <TextAreaField
            label="Питання (JSON)"
            rows={8}
            value={form.questions}
            onChange={(e) => setForm({ ...form, questions: e.target.value })}
          />
          <Button type="submit" isLoading={isSaving}>Створити тест теми</Button>
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
