import { useEffect, useState, type FormEvent } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, ChevronRight, CheckCircle2, FileQuestion, Pencil,
  Plus, Trash2, BookOpen, GripVertical, FileText, PlayCircle,
} from "lucide-react";
import { topicsApi } from "../../api/topics";
import { lessonsApi } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import { ApiError } from "../../api/client";
import type { Lesson, Topic, Test, TestQuestion } from "../../types";
import { EmptyState, Badge, SkeletonList, Spinner } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField } from "../../components/FormField";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

const ICONS: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, pdf: FileText };

// ── TopicTestModal ────────────────────────────────────────────────
function blankQuestion(): TestQuestion {
  return { question: "", options: ["", ""], correctIndex: 0 };
}

type TopicTestMode = "view" | "create" | "edit";

function TopicTestModal({ topic, isOpen, onClose, isReadOnly }: {
  topic: Topic; isOpen: boolean; onClose: () => void; isReadOnly: boolean;
}) {
  const { notify } = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<TopicTestMode>("view");
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
    setTitle(`Тест теми «${topic.title}»`);
    setPassingScore(70);
    setMaxAttempts("");
    setQuestions([blankQuestion()]);
    testsApi
      .getByTopic(topic.id)
      .then(setTest)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          notify(getErrorMessage(err), "error");
        }
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, topic.id]);

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
    e.preventDefault(); setIsSaving(true);
    try {
      const created = await testsApi.createForTopic(topic.id, {
        title, questions, passingScore,
        maxAttempts: maxAttempts === "" ? null : maxAttempts,
      });
      setTest(created); setMode("view");
      notify("Тест теми створено", "success");
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSaving(false); }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); if (!test) return; setIsSaving(true);
    try {
      const updated = await testsApi.updateTopicTest(topic.id, {
        title, questions, passingScore,
        maxAttempts: maxAttempts === "" ? null : maxAttempts,
      });
      setTest(updated); setMode("view");
      notify("Тест теми оновлено", "success");
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSaving(false); }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await testsApi.deleteForTopic(topic.id);
      setTest(null);
      setConfirmDelete(false);
      setMode("view");
      notify("Тест теми видалено", "success");
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsDeleting(false); }
  }

  function renderForm(isEdit: boolean) {
    return (
      <form onSubmit={isEdit ? handleUpdate : handleCreate} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Назва тесту" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Прохідний бал (%)" type="number" min={0} max={100}
            value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
        </div>
        <TextField label="Макс. спроб" type="number" min={1} placeholder="∞"
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(e.target.value === "" ? "" : Number(e.target.value))} />

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="rounded-xl border border-line bg-paper-raised p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <TextField label={`Питання ${qIdx + 1}`} required value={q.question}
                  onChange={(e) => updateQuestion(qIdx, { question: e.target.value })} />
              </div>
              {questions.length > 1 && (
                <button type="button" onClick={() => removeQuestion(qIdx)}
                  className="mt-7 rounded p-2 text-coral-dark hover:bg-coral/5" aria-label="Видалити питання">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {q.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${qIdx}`}
                    checked={q.correctIndex === optIdx}
                    onChange={() => updateQuestion(qIdx, { correctIndex: optIdx })}
                    title="Правильна відповідь" className="accent-teal" />
                  <input required value={opt} onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                    placeholder={`Варіант ${optIdx + 1}`}
                    className="flex-1 rounded-md border border-line bg-paper-raised px-3 py-2 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark" />
                  {q.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(qIdx, optIdx)}
                      className="rounded p-1.5 text-slate hover:bg-ink/5" aria-label="Видалити варіант">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => addOption(qIdx)}
                className="mt-1 self-start text-xs font-medium text-gold-dark hover:underline">
                + варіант відповіді
              </button>
            </div>
          </div>
        ))}

        <Button type="button" variant="ghost" onClick={addQuestion} className="self-start">
          <Plus className="h-4 w-4" /> Додати питання
        </Button>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={cancelEdit}>Скасувати</Button>
          <Button type="submit" isLoading={isSaving} className="flex-1">
            {isEdit ? "Зберегти зміни" : "Зберегти тест"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={`Тест теми «${topic.title}»`} size="md">
      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
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
              <div key={idx} className="rounded-xl border border-line bg-paper-raised p-4">
                <p className="font-medium text-ink">{idx + 1}. {q.question}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {q.options.map((opt, optIdx) => (
                    <li key={optIdx}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        optIdx === q.correctIndex ? "bg-teal/10 text-teal-dark" : "text-ink/80"
                      }`}>
                      {optIdx === q.correctIndex && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
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
              ? "Викладач ще не додав тест для цієї теми."
              : "Додайте тест для цієї теми — він відкриється студенту після проходження всіх уроків теми."
          }
          action={
            isReadOnly ? undefined : (
              <Button onClick={() => { setTitle(`Тест теми «${topic.title}»`); setMode("create"); }}>
                <Plus className="h-4 w-4" /> Створити тест
              </Button>
            )
          }
        />
      )}
    </Modal>

    <ConfirmDialog
      isOpen={confirmDelete}
      title="Видалити тест теми?"
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

// ── AssignLessonsModal ────────────────────────────────────────────
function AssignLessonsModal({ topic, allLessons, assignedToOtherTopics, isOpen, onClose, onSaved }: {
  topic: Topic; allLessons: Lesson[]; assignedToOtherTopics: Set<string>;
  isOpen: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { notify } = useToast();
  const assignedIds = new Set(topic.lessons.map((l) => l.id));
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [isSaving, setIsSaving] = useState(false);

  const available = allLessons.filter((l) => assignedIds.has(l.id) || !assignedToOtherTopics.has(l.id));

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await topicsApi.assignLessons(topic.id, [...selected]);
      notify("Уроки призначено", "success"); onSaved(); onClose();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Уроки теми «${topic.title}»`}
      description="Оберіть уроки що входять до цієї теми">
      <div className="flex flex-col gap-3">
        {available.length === 0 ? (
          <EmptyState title="Немає доступних уроків"
            description="Всі уроки вже призначені до інших тем." />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line overflow-hidden">
            {available.map((l) => {
              const Icon = ICONS[l.type] ?? FileText;
              return (
                <li key={l.id}>
                  <label htmlFor={`al-${l.id}`}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-paper-sunken/60 transition-colors">
                    <input id={`al-${l.id}`} type="checkbox" checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)} className="h-4 w-4 accent-gold-dark rounded" />
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate" />
                    <span className="flex-1 text-sm text-ink">{l.title}</span>
                    <Badge>{LESSON_TYPE_LABELS[l.type]}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Скасувати</Button>
          <Button className="flex-1" onClick={handleSave} isLoading={isSaving}
            disabled={available.length === 0}>Зберегти</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── SortableTopicCard ─────────────────────────────────────────────
function SortableTopicCard({ topic, isReadOnly, isExpanded, onToggle, onEdit, onDelete, onTest, onAssign, onLessonTest }: {
  topic: Topic; isReadOnly: boolean; isExpanded: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onTest: () => void; onAssign: () => void; onLessonTest: (l: Lesson) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id, disabled: isReadOnly,
  });

  const sortedLessons = [...topic.lessons].sort((a, b) => a.order - b.order);

  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-xs">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3.5">
        {!isReadOnly && (
          <button {...attributes} {...listeners}
            className="drag-handle shrink-0 rounded-lg p-1" aria-label="Перетягнути тему">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button onClick={onToggle}
          className="shrink-0 rounded-md p-1 text-slate hover:bg-ink/6 hover:text-ink transition-colors"
          aria-expanded={isExpanded}>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-ink truncate">{topic.title}</p>
          {topic.description && <p className="text-xs text-slate truncate mt-0.5">{topic.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate mr-1">
            {sortedLessons.length} {sortedLessons.length === 1 ? "урок" : "уроків"}
          </span>
          {topic.test && <Badge tone="gold">Тест</Badge>}
          {!isReadOnly && (
            <>
              <button onClick={onAssign} title="Призначити уроки"
                className="rounded-lg p-1.5 text-slate hover:bg-ink/6 hover:text-ink transition-colors">
                <BookOpen className="h-3.5 w-3.5" />
              </button>
              <button onClick={onTest} title="Тест теми"
                className="rounded-lg p-1.5 text-slate hover:bg-ink/6 hover:text-ink transition-colors">
                <FileQuestion className="h-3.5 w-3.5" />
              </button>
              <button onClick={onEdit} title="Редагувати"
                className="rounded-lg p-1.5 text-slate hover:bg-ink/6 hover:text-ink transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} title="Видалити"
                className="rounded-lg p-1.5 text-coral-dark hover:bg-coral/8 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lessons */}
      {isExpanded && (
        <div className="border-t border-line">
          {sortedLessons.length === 0 ? (
            <div className="px-6 py-4 text-xs text-slate italic">
              Уроків у темі немає.
              {!isReadOnly && (
                <button onClick={onAssign} className="ml-1.5 font-medium text-gold-dark hover:underline">
                  Додати уроки →
                </button>
              )}
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {sortedLessons.map((lesson, idx) => {
                const Icon = ICONS[lesson.type] ?? FileText;
                return (
                  <li key={lesson.id}
                    className="group flex items-center gap-3 px-6 py-2.5 hover:bg-paper-sunken/50 transition-colors">
                    <span className="font-mono text-[11px] text-slate-light w-5 text-right shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-light" />
                    <span className="flex-1 min-w-0 truncate text-sm text-ink">{lesson.title}</span>
                    <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
                    <button onClick={() => onLessonTest(lesson)} title="Тест уроку"
                      className="rounded-lg p-1.5 text-slate opacity-0 group-hover:opacity-100 hover:bg-ink/6 transition-all">
                      <FileQuestion className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
              {topic.test && (
                <li className="group flex items-center gap-3 bg-gold/4 border-t border-gold/12 px-6 py-2.5">
                  <FileQuestion className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
                  <span className="flex-1 text-sm font-medium text-ink">{topic.test.title}</span>
                  <span className="text-xs text-slate">прохідний бал {topic.test.passingScore}%</span>
                  {!isReadOnly && (
                    <button onClick={onTest} title="Редагувати тест теми"
                      className="rounded-lg p-1.5 text-gold-dark opacity-0 group-hover:opacity-100 hover:bg-gold/10 transition-all">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function TopicGhost({ topic }: { topic: Topic }) {
  return (
    <div className="dnd-dragging flex items-center gap-3 rounded-2xl border border-line bg-paper-raised px-4 py-3.5">
      <GripVertical className="h-4 w-4 text-slate" />
      <p className="flex-1 font-semibold text-sm text-ink">{topic.title}</p>
      <span className="text-xs text-slate">{topic.lessons.length} уроків</span>
    </div>
  );
}

// ── TopicsManager (main) ──────────────────────────────────────────
export function TopicsManager({ courseId, isReadOnly = false }: { courseId: string; isReadOnly?: boolean }) {
  const { notify } = useToast();
  const [topics, setTopics]       = useState<Topic[] | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [activeId, setActiveId]   = useState<string | null>(null);

  const [topicModal, setTopicModal] = useState<{ open: boolean; editing: Topic | null }>({ open: false, editing: null });
  const [topicForm, setTopicForm]   = useState({ title: "", description: "" });
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [testTopic, setTestTopic]         = useState<Topic | null>(null);
  const [assignTopic, setAssignTopic]     = useState<Topic | null>(null);
  const [lessonTest, setLessonTest]       = useState<Lesson | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function reload() {
    Promise.all([topicsApi.listByCourse(courseId), lessonsApi.listByCourse(courseId)])
      .then(([t, l]) => {
        const sorted = [...t].sort((a, b) => a.order - b.order);
        setTopics(sorted);
        setAllLessons(l);
        setExpanded(new Set(sorted.map((tp) => tp.id)));
      })
      .catch((err) => notify(getErrorMessage(err), "error"));
  }
  useEffect(reload, [courseId]); // eslint-disable-line

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id || !topics) return;
    const oi = topics.findIndex((t) => t.id === active.id);
    const ni = topics.findIndex((t) => t.id === over.id);
    if (oi === -1 || ni === -1) return;
    const reordered = arrayMove(topics, oi, ni).map((t, i) => ({ ...t, order: i }));
    setTopics(reordered);
    try {
      await Promise.all(reordered.map((t) => topicsApi.update(t.id, { order: t.order })));
    } catch (err) { notify(getErrorMessage(err), "error"); reload(); }
  }

  function openCreate() { setTopicForm({ title: "", description: "" }); setTopicModal({ open: true, editing: null }); }
  function openEdit(topic: Topic) {
    setTopicForm({ title: topic.title, description: topic.description ?? "" });
    setTopicModal({ open: true, editing: topic });
  }

  async function handleTopicSubmit(e: FormEvent) {
    e.preventDefault(); setIsSavingTopic(true);
    try {
      topicModal.editing
        ? await topicsApi.update(topicModal.editing.id, { title: topicForm.title, description: topicForm.description || null })
        : await topicsApi.create(courseId, { title: topicForm.title, description: topicForm.description || null });
      notify(topicModal.editing ? "Тему оновлено" : "Тему додано", "success");
      setTopicModal({ open: false, editing: null }); reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSavingTopic(false); }
  }

  async function handleDelete() {
    if (!pendingDelete) return; setIsDeleting(true);
    try {
      await topicsApi.remove(pendingDelete.id);
      notify("Тему видалено. Уроки збережено.", "success");
      setPendingDelete(null); reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsDeleting(false); }
  }

  if (!topics) return <SkeletonList rows={3} />;

  const assignedIds = new Set(topics.flatMap((t) => t.lessons.map((l) => l.id)));
  const unassigned  = allLessons.filter((l) => !assignedIds.has(l.id));
  const activeTopic = activeId ? topics.find((t) => t.id === activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Теми курсу</h2>
          {topics.length > 1 && !isReadOnly && (
            <p className="mt-0.5 text-xs text-slate">Перетягуйте теми щоб змінити порядок</p>
          )}
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Додати тему
          </Button>
        )}
      </div>

      {topics.length === 0 ? (
        <EmptyState
          title="Тем ще немає"
          description="Структуруйте курс по темах — кожна тема може мати кілька уроків і свій тест."
          action={!isReadOnly && (
            <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Додати першу тему
            </Button>
          )}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}>
          <SortableContext items={topics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2.5">
              {topics.map((topic) => (
                <SortableTopicCard key={topic.id} topic={topic} isReadOnly={isReadOnly}
                  isExpanded={expanded.has(topic.id)} onToggle={() => toggleExpand(topic.id)}
                  onEdit={() => openEdit(topic)} onDelete={() => setPendingDelete(topic)}
                  onTest={() => setTestTopic(topic)} onAssign={() => setAssignTopic(topic)}
                  onLessonTest={setLessonTest} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {activeTopic && <TopicGhost topic={activeTopic} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper-sunken/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">
            Уроки без теми ({unassigned.length})
          </p>
          <ol className="flex flex-col gap-1.5">
            {unassigned.map((l) => {
              const Icon = ICONS[l.type] ?? FileText;
              return (
                <li key={l.id} className="flex items-center gap-2.5 text-sm text-ink/70">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-light" />
                  <span className="flex-1 truncate">{l.title}</span>
                  <Badge>{LESSON_TYPE_LABELS[l.type]}</Badge>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={topicModal.open} onClose={() => setTopicModal({ open: false, editing: null })}
        title={topicModal.editing ? "Редагувати тему" : "Нова тема"}
        description={topicModal.editing ? undefined : "Тема об'єднує кілька уроків і може мати свій тест."}>
        <form onSubmit={handleTopicSubmit} className="flex flex-col gap-4">
          <TextField label="Назва теми" required minLength={2} maxLength={255}
            placeholder="Наприклад: Основи синтаксису" value={topicForm.title}
            onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })} />
          <TextAreaField label="Опис теми" rows={3}
            placeholder="Необов'язково — короткий опис що охоплює тема"
            value={topicForm.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTopicForm({ ...topicForm, description: e.target.value })} />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1"
              onClick={() => setTopicModal({ open: false, editing: null })}>Скасувати</Button>
            <Button type="submit" isLoading={isSavingTopic} className="flex-1">
              {topicModal.editing ? "Зберегти зміни" : "Додати тему"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!pendingDelete} title="Видалити тему?"
        description={`Тема «${pendingDelete?.title}» буде видалена. Уроки залишаться без теми.`}
        confirmLabel="Так, видалити" isDanger isLoading={isDeleting}
        onConfirm={handleDelete} onCancel={() => setPendingDelete(null)} />

      {testTopic && (
        <TopicTestModal topic={testTopic} isOpen={!!testTopic}
          onClose={() => { setTestTopic(null); reload(); }} isReadOnly={isReadOnly} />
      )}
      {assignTopic && (
        <AssignLessonsModal topic={assignTopic} allLessons={allLessons}
          assignedToOtherTopics={new Set(
            topics.filter((t) => t.id !== assignTopic.id).flatMap((t) => t.lessons.map((l) => l.id))
          )}
          isOpen={!!assignTopic} onClose={() => setAssignTopic(null)} onSaved={reload} />
      )}
      {lessonTest && (
        <LessonTestModal lessonId={lessonTest.id} lessonTitle={lessonTest.title}
          isOpen={!!lessonTest} onClose={() => setLessonTest(null)} isReadOnly={isReadOnly} />
      )}
    </div>
  );
}