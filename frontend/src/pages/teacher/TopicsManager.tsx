import { useEffect, useState, type FormEvent } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, ChevronRight, FileQuestion, Pencil,
  Plus, Trash2, BookOpen, GripVertical, FileText, PlayCircle,
} from "lucide-react";
import { topicsApi } from "../../api/topics";
import { lessonsApi } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import type { Lesson, Topic } from "../../types";
import { EmptyState, Badge, SkeletonList } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField } from "../../components/FormField";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

const ICONS: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, pdf: FileText };

// ── TopicTestModal ────────────────────────────────────────────────
function TopicTestModal({ topic, isOpen, onClose, isReadOnly }: {
  topic: Topic; isOpen: boolean; onClose: () => void; isReadOnly: boolean;
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
    e.preventDefault(); setIsSaving(true);
    try {
      let parsed: unknown[];
      try { parsed = JSON.parse(form.questions); }
      catch { notify("Невірний JSON питань", "error"); setIsSaving(false); return; }
      const created = await testsApi.createForTopic(topic.id, {
        title: form.title, passingScore: form.passingScore,
        maxAttempts: form.maxAttempts === "" ? null : Number(form.maxAttempts),
        questions: parsed as never,
      });
      setTest(created as never);
      notify("Тест теми створено", "success"); onClose();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Тест теми «${topic.title}»`} size="md">
      {test ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
            <p className="font-semibold text-ink">{test.title}</p>
            <p className="mt-1 text-sm text-slate">
              Прохідний бал: {test.passingScore}% · {test.maxAttempts ? `Спроб: ${test.maxAttempts}` : "Необмежено"}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>Закрити</Button>
        </div>
      ) : isReadOnly ? (
        <p className="text-sm text-slate">Тест не додано.</p>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="rounded-xl bg-ink/4 px-3.5 py-2.5 text-xs text-slate">
            Питання — JSON масив:{" "}
            <code className="font-mono text-ink text-[11px]">
              {`[{"question":"...","options":["A","B"],"correctIndex":0}]`}
            </code>
          </div>
          <TextField label="Назва тесту" required value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Прохідний бал (%)" type="number" min={0} max={100}
              value={form.passingScore}
              onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
            <TextField label="Макс. спроб" type="number" min={1} placeholder="∞"
              value={form.maxAttempts}
              onChange={(e) => setForm({ ...form, maxAttempts: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <TextAreaField label="Питання (JSON)" rows={8} className="font-mono text-xs"
            value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Скасувати</Button>
            <Button type="submit" isLoading={isSaving} className="flex-1">Створити тест теми</Button>
          </div>
        </form>
      )}
    </Modal>
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
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
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
                <li className="flex items-center gap-3 bg-gold/4 border-t border-gold/12 px-6 py-2.5">
                  <FileQuestion className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
                  <span className="flex-1 text-sm font-medium text-ink">{topic.test.title}</span>
                  <span className="text-xs text-slate">прохідний бал {topic.test.passingScore}%</span>
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
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
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
      if (topicModal.editing) {
        await topicsApi.update(topicModal.editing.id, { title: topicForm.title, description: topicForm.description || null });
      } else {
        await topicsApi.create(courseId, { title: topicForm.title, description: topicForm.description || null });
      }
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
            onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
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
