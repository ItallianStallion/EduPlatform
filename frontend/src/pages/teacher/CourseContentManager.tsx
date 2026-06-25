import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable,
  DragOverlay, type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  ChevronDown, ChevronRight, FileQuestion, Pencil, Plus, Trash2,
  BookOpen, GripVertical, FileText, PlayCircle,
} from "lucide-react";
import { topicsApi } from "../../api/topics";
import { lessonsApi, type LessonUpsertPayload } from "../../api/lessons";
import { testsApi } from "../../api/tests";
import type { Lesson, LessonType, Topic } from "../../types";
import { EmptyState, Badge, SkeletonList } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField, SelectField } from "../../components/FormField";
import { SortableItem, DragHandle } from "../../components/dnd";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { cn } from "../../utils/cn";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

const ICONS: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, pdf: FileText };
const EMPTY_LESSON: LessonUpsertPayload = { title: "", type: "text", content: "", videoUrl: "", pdfUrl: "" };
const UNASSIGNED = "unassigned";

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

// ── AssignLessonsModal (швидке масове призначення — альтернатива drag&drop) ─
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
      if (n.has(id)) n.delete(id); else n.add(id);
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
      description="Швидко оберіть кілька уроків одразу — або просто перетягніть їх у тему мишкою.">
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

// ── LessonRow ──────────────────────────────────────────────────────
function LessonRow({ lesson, index, isReadOnly, onEdit, onDelete, onTest }: {
  lesson: Lesson; index: number; isReadOnly: boolean;
  onEdit: (l: Lesson) => void; onDelete: (l: Lesson) => void; onTest: (l: Lesson) => void;
}) {
  const Icon = ICONS[lesson.type] ?? FileText;
  return (
    <SortableItem id={lesson.id} disabled={isReadOnly}>
      {({ handleProps }) => (
        <div className="group flex items-center gap-2.5 px-6 py-2.5 hover:bg-paper-sunken/50 transition-colors">
          <DragHandle handleProps={handleProps} disabled={isReadOnly} label="Перетягнути урок" />
          <span className="font-mono text-[11px] text-slate-light w-5 text-right shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-light" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{lesson.title}</span>
          <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button onClick={() => onTest(lesson)}
              className="rounded-lg p-1.5 text-slate hover:bg-ink/8 hover:text-ink transition-colors"
              title="Тест уроку" aria-label="Тест уроку">
              <FileQuestion className="h-3.5 w-3.5" />
            </button>
            {!isReadOnly && (
              <>
                <button onClick={() => onEdit(lesson)}
                  className="rounded-lg p-1.5 text-slate hover:bg-ink/8 hover:text-ink transition-colors"
                  aria-label="Редагувати урок">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDelete(lesson)}
                  className="rounded-lg p-1.5 text-coral-dark hover:bg-coral/8 transition-colors"
                  aria-label="Видалити урок">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </SortableItem>
  );
}

function RowGhost({ lesson }: { lesson: Lesson }) {
  const Icon = ICONS[lesson.type] ?? FileText;
  return (
    <div className="dnd-dragging flex items-center gap-2.5 rounded-xl border border-line bg-paper-raised px-4 py-3 shadow-lg">
      <GripVertical className="h-4 w-4 text-slate" />
      <Icon className="h-3.5 w-3.5 text-slate" />
      <span className="text-sm font-medium text-ink">{lesson.title}</span>
      <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
    </div>
  );
}

function TopicGhost({ topic, lessonsCount }: { topic: Topic; lessonsCount: number }) {
  return (
    <div className="dnd-dragging flex items-center gap-3 rounded-2xl border border-line bg-paper-raised px-4 py-3.5 shadow-lg">
      <GripVertical className="h-4 w-4 text-slate" />
      <p className="flex-1 font-semibold text-sm text-ink">{topic.title}</p>
      <span className="text-xs text-slate">{lessonsCount} уроків</span>
    </div>
  );
}

// ── LessonsDropZone (спільне тіло для теми й «Без теми») ───────────
function LessonsDropZone({ containerId, lessons, isReadOnly, onAddLesson, onEditLesson, onDeleteLesson, onLessonTest, emptyHint }: {
  containerId: string; lessons: Lesson[]; isReadOnly: boolean;
  onAddLesson: () => void; onEditLesson: (l: Lesson) => void;
  onDeleteLesson: (l: Lesson) => void; onLessonTest: (l: Lesson) => void;
  emptyHint: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  return (
    <div ref={setNodeRef} className={cn("transition-colors", isOver && "bg-gold/6")}>
      <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        {lessons.length === 0 ? (
          <div className="px-6 py-5 text-center text-xs text-slate italic">
            {emptyHint}
            {!isReadOnly && (
              <>
                {" "}
                <button onClick={onAddLesson} className="font-medium text-gold-dark hover:underline">
                  додайте новий →
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {lessons.map((l, i) => (
              <LessonRow key={l.id} lesson={l} index={i} isReadOnly={isReadOnly}
                onEdit={onEditLesson} onDelete={onDeleteLesson} onTest={onLessonTest} />
            ))}
          </div>
        )}
      </SortableContext>
      {!isReadOnly && lessons.length > 0 && (
        <button onClick={onAddLesson}
          className="flex w-full items-center gap-2 border-t border-line/70 px-6 py-2.5 text-xs font-medium text-slate hover:bg-paper-sunken/60 hover:text-ink transition-colors">
          <Plus className="h-3.5 w-3.5" /> Додати урок
        </button>
      )}
    </div>
  );
}

// ── TopicCard ────────────────────────────────────────────────────--
function TopicCard({ topic, lessons, isReadOnly, isExpanded, onToggle, onEdit, onDelete, onTest, onAssign, onAddLesson, onEditLesson, onDeleteLesson, onLessonTest }: {
  topic: Topic; lessons: Lesson[]; isReadOnly: boolean; isExpanded: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onTest: () => void; onAssign: () => void; onAddLesson: () => void;
  onEditLesson: (l: Lesson) => void; onDeleteLesson: (l: Lesson) => void; onLessonTest: (l: Lesson) => void;
}) {
  return (
    <SortableItem id={topic.id} disabled={isReadOnly}
      className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-xs">
      {({ handleProps }) => (
        <>
          <div className="flex items-center gap-2 px-4 py-3.5">
            <DragHandle handleProps={handleProps} disabled={isReadOnly} label="Перетягнути тему" />
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
                {lessons.length} {lessons.length === 1 ? "урок" : "уроків"}
              </span>
              {topic.test && <Badge tone="gold">Тест</Badge>}
              {!isReadOnly && (
                <>
                  <button onClick={onAssign} title="Призначити уроки списком"
                    className="rounded-lg p-1.5 text-slate hover:bg-ink/6 hover:text-ink transition-colors">
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={onTest} title="Тест теми"
                    className="rounded-lg p-1.5 text-slate hover:bg-ink/6 hover:text-ink transition-colors">
                    <FileQuestion className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={onEdit} title="Редагувати тему"
                    className="rounded-lg p-1.5 text-slate hover:bg-ink/6 hover:text-ink transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={onDelete} title="Видалити тему"
                    className="rounded-lg p-1.5 text-coral-dark hover:bg-coral/8 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="border-t border-line">
              <LessonsDropZone containerId={topic.id} lessons={lessons} isReadOnly={isReadOnly}
                onAddLesson={onAddLesson} onEditLesson={onEditLesson}
                onDeleteLesson={onDeleteLesson} onLessonTest={onLessonTest}
                emptyHint="Перетягніть сюди урок з іншої теми або" />
              {topic.test && (
                <div className="flex items-center gap-3 border-t border-gold/12 bg-gold/4 px-6 py-2.5">
                  <FileQuestion className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
                  <span className="flex-1 text-sm font-medium text-ink">{topic.test.title}</span>
                  <span className="text-xs text-slate">прохідний бал {topic.test.passingScore}%</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SortableItem>
  );
}

// ── UnassignedSection ────────────────────────────────────────────--
function UnassignedSection({ lessons, isReadOnly, isExpanded, onToggle, onAddLesson, onEditLesson, onDeleteLesson, onLessonTest }: {
  lessons: Lesson[]; isReadOnly: boolean; isExpanded: boolean; onToggle: () => void;
  onAddLesson: () => void; onEditLesson: (l: Lesson) => void;
  onDeleteLesson: (l: Lesson) => void; onLessonTest: (l: Lesson) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-dashed border-line-strong bg-paper-sunken/40">
      <div className="flex items-center gap-2 px-4 py-3.5">
        <div className="w-7 shrink-0" aria-hidden="true" />
        <button onClick={onToggle}
          className="shrink-0 rounded-md p-1 text-slate hover:bg-ink/6 hover:text-ink transition-colors"
          aria-expanded={isExpanded}>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-ink/70">Без теми</p>
          <p className="text-xs text-slate mt-0.5">Уроки, які ще не належать жодній темі</p>
        </div>
        <span className="text-xs text-slate">
          {lessons.length} {lessons.length === 1 ? "урок" : "уроків"}
        </span>
        {!isReadOnly && (
          <button onClick={onAddLesson}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate hover:bg-ink/6 hover:text-ink transition-colors"
            title="Додати новий урок без теми">
            <Plus className="h-3.5 w-3.5" /> Додати урок
          </button>
        )}
      </div>
      {isExpanded && (
        <div className="border-t border-line-strong/60">
          <LessonsDropZone containerId={UNASSIGNED} lessons={lessons} isReadOnly={isReadOnly}
            onAddLesson={onAddLesson} onEditLesson={onEditLesson}
            onDeleteLesson={onDeleteLesson} onLessonTest={onLessonTest}
            emptyHint="Перетягніть сюди урок з будь-якої теми або" />
        </div>
      )}
    </div>
  );
}

// ── CourseContentManager (main) ─────────────────────────────────────
export function CourseContentManager({ courseId, isReadOnly = false }: { courseId: string; isReadOnly?: boolean }) {
  const { notify } = useToast();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [items, setItemsState] = useState<Record<string, string[]>>({});
  const itemsRef = useRef<Record<string, string[]>>({});
  const initializedExpand = useRef(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"topic" | "lesson" | null>(null);
  // Snapshot стану контейнерів на момент початку драгу — потрібен щоб
  // порівняти "до" і "після" у handleDragEnd (бо handleDragOver вже змінює itemsRef).
  const itemsSnapshotRef = useRef<Record<string, string[]>>({});

  const [topicModal, setTopicModal] = useState<{ open: boolean; editing: Topic | null }>({ open: false, editing: null });
  const [topicForm, setTopicForm] = useState({ title: "", description: "" });
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState<Topic | null>(null);
  const [isDeletingTopic, setIsDeletingTopic] = useState(false);
  const [testTopic, setTestTopic] = useState<Topic | null>(null);
  const [assignTopic, setAssignTopic] = useState<Topic | null>(null);

  const [lessonModal, setLessonModal] = useState<{ open: boolean; editing: Lesson | null; containerId: string | null }>({
    open: false, editing: null, containerId: null,
  });
  const [lessonForm, setLessonForm] = useState<LessonUpsertPayload>(EMPTY_LESSON);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [pendingDeleteLesson, setPendingDeleteLesson] = useState<Lesson | null>(null);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);
  const [lessonTest, setLessonTest] = useState<Lesson | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const lessonsById = useMemo(() => {
    const map: Record<string, Lesson> = {};
    allLessons.forEach((l) => { map[l.id] = l; });
    return map;
  }, [allLessons]);

  function commitItems(next: Record<string, string[]>) {
    itemsRef.current = next;
    setItemsState(next);
  }

  function reload() {
    Promise.all([topicsApi.listByCourse(courseId), lessonsApi.listByCourse(courseId)])
      .then(([t, l]) => {
        const sortedTopics = [...t].sort((a, b) => a.order - b.order);
        setTopics(sortedTopics);
        setAllLessons(l);

        const assignedIds = new Set(sortedTopics.flatMap((tp) => tp.lessons.map((ls) => ls.id)));
        const next: Record<string, string[]> = {
          [UNASSIGNED]: l.filter((ls) => !assignedIds.has(ls.id)).slice().sort((a, b) => a.order - b.order).map((ls) => ls.id),
        };
        sortedTopics.forEach((tp) => {
          next[tp.id] = [...tp.lessons].sort((a, b) => a.order - b.order).map((ls) => ls.id);
        });
        commitItems(next);

        if (!initializedExpand.current) {
          initializedExpand.current = true;
          setExpanded(new Set([...sortedTopics.map((tp) => tp.id), UNASSIGNED]));
        }
      })
      .catch((err) => notify(getErrorMessage(err), "error"));
  }
  useEffect(reload, [courseId]); // eslint-disable-line

  function lessonsFor(containerId: string): Lesson[] {
    return (items[containerId] ?? []).map((id) => lessonsById[id]).filter(Boolean);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function findContainer(id: string): string | undefined {
    if (id in itemsRef.current) return id;
    return Object.keys(itemsRef.current).find((key) => itemsRef.current[key].includes(id));
  }

  // ── DnD ────────────────────────────────────────────────────────
  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveId(id);
    setActiveType(topics?.some((t) => t.id === id) ? "topic" : "lesson");
    // Зберігаємо snapshot ДО будь-яких змін handleDragOver
    itemsSnapshotRef.current = { ...itemsRef.current };
  }

  function handleDragOver(e: DragOverEvent) {
    if (activeType !== "lesson") return;
    const { active, over } = e;
    if (!over) return;
    const activeItemId = String(active.id);
    const overId = String(over.id);
    const fromContainer = findContainer(activeItemId);
    const toContainer = findContainer(overId);
    if (!fromContainer || !toContainer || fromContainer === toContainer) return;

    const fromItems = itemsRef.current[fromContainer];
    const toItems = itemsRef.current[toContainer];
    const overIndex = toItems.indexOf(overId);
    const newIndex = overIndex >= 0 ? overIndex : toItems.length;

    commitItems({
      ...itemsRef.current,
      [fromContainer]: fromItems.filter((id) => id !== activeItemId),
      [toContainer]: [...toItems.slice(0, newIndex), activeItemId, ...toItems.slice(newIndex)],
    });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const type = activeType;
    setActiveId(null); setActiveType(null);
    const { active, over } = e;

    if (type === "topic") {
      if (!over || active.id === over.id || !topics) return;
      const oi = topics.findIndex((t) => t.id === active.id);
      const ni = topics.findIndex((t) => t.id === over.id);
      if (oi === -1 || ni === -1) return;
      const reordered = arrayMove(topics, oi, ni).map((t, i) => ({ ...t, order: i }));
      setTopics(reordered);
      try {
        await Promise.all(reordered.map((t) => topicsApi.update(t.id, { order: t.order })));
      } catch (err) { notify(getErrorMessage(err), "error"); reload(); }
      return;
    }

    if (!over || !topics) return;
    const activeItemId = String(active.id);
    const overId = String(over.id);
    const container = findContainer(activeItemId);
    if (!container) return;

    const before = itemsSnapshotRef.current; // стан ДО драгу
    const current = itemsRef.current;
    const containerItems = current[container];
    const activeIndex = containerItems.indexOf(activeItemId);
    const overIndex = overId in current ? containerItems.length - 1 : containerItems.indexOf(overId);
    const finalContainerItems = overIndex !== -1 && activeIndex !== overIndex
      ? arrayMove(containerItems, activeIndex, overIndex)
      : containerItems;
    const after = { ...current, [container]: finalContainerItems };
    commitItems(after);

    try {
      const topicIds = topics.map((t) => t.id);
      // Порівнюємо з before (snapshot до драгу) — так ловимо переміщення між контейнерами
      const assignCalls = topicIds
        .filter((tid) => {
          const a = before[tid] ?? [];
          const b = after[tid] ?? [];
          if (a.length !== b.length) return true;
          return a.some((id, i) => b[i] !== id);
        })
        .map((tid) => topicsApi.assignLessons(tid, after[tid]));

      const orderSequence = [...topicIds.flatMap((tid) => after[tid] ?? []), ...(after[UNASSIGNED] ?? [])];
      const orderCalls = orderSequence
        .map((lessonId, idx) => ({ lessonId, idx }))
        .filter(({ lessonId, idx }) => lessonsById[lessonId]?.order !== idx)
        .map(({ lessonId, idx }) => lessonsApi.update(lessonId, { order: idx }));

      if (assignCalls.length || orderCalls.length) {
        await Promise.all([...assignCalls, ...orderCalls]);
        reload();
      }
    } catch (err) {
      notify(getErrorMessage(err), "error");
      reload();
    }
  }

  // ── Topic CRUD ───────────────────────────────────────────────────
  function openCreateTopic() { setTopicForm({ title: "", description: "" }); setTopicModal({ open: true, editing: null }); }
  function openEditTopic(topic: Topic) {
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

  async function handleDeleteTopic() {
    if (!pendingDeleteTopic) return; setIsDeletingTopic(true);
    try {
      await topicsApi.remove(pendingDeleteTopic.id);
      notify("Тему видалено. Уроки збережено.", "success");
      setPendingDeleteTopic(null); reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsDeletingTopic(false); }
  }

  // ── Lesson CRUD ──────────────────────────────────────────────────
  function openCreateLesson(containerId: string) {
    setLessonForm(EMPTY_LESSON);
    setLessonModal({ open: true, editing: null, containerId });
  }
  function openEditLesson(lesson: Lesson) {
    setLessonForm({
      title: lesson.title, type: lesson.type, content: lesson.content ?? "",
      videoUrl: lesson.videoUrl ?? "", pdfUrl: lesson.pdfUrl ?? "",
    });
    setLessonModal({ open: true, editing: lesson, containerId: null });
  }

  async function handleLessonSubmit(e: FormEvent) {
    e.preventDefault(); setIsSavingLesson(true);
    try {
      const p: LessonUpsertPayload = {
        title: lessonForm.title, type: lessonForm.type,
        content: lessonForm.type === "text" ? lessonForm.content : null,
        videoUrl: lessonForm.type === "video" ? lessonForm.videoUrl : null,
        pdfUrl: lessonForm.type === "pdf" ? lessonForm.pdfUrl : null,
      };
      if (lessonModal.editing) {
        await lessonsApi.update(lessonModal.editing.id, p);
        notify("Урок оновлено", "success");
      } else {
        const created = await lessonsApi.create(courseId, p);
        const containerId = lessonModal.containerId;
        if (containerId && containerId !== UNASSIGNED) {
          const currentIds = itemsRef.current[containerId] ?? [];
          await topicsApi.assignLessons(containerId, [...currentIds, created.id]);
        }
        notify("Урок додано", "success");
      }
      setLessonModal({ open: false, editing: null, containerId: null });
      reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSavingLesson(false); }
  }

  async function handleDeleteLesson() {
    if (!pendingDeleteLesson) return; setIsDeletingLesson(true);
    try {
      await lessonsApi.remove(pendingDeleteLesson.id);
      notify("Урок видалено", "success");
      setPendingDeleteLesson(null); reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsDeletingLesson(false); }
  }

  if (!topics) return <SkeletonList rows={4} />;

  const topicIds = topics.map((t) => t.id);
  const unassignedLessons = lessonsFor(UNASSIGNED);
  const activeTopic = activeType === "topic" && activeId ? topics.find((t) => t.id === activeId) ?? null : null;
  const activeLesson = activeType === "lesson" && activeId ? lessonsById[activeId] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Зміст курсу</h2>
          <p className="mt-0.5 text-xs text-slate">
            Перетягуйте теми й уроки — урок можна перенести в іншу тему просто мишкою
          </p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={openCreateTopic} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Додати тему
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>

        {topics.length === 0 ? (
          <EmptyState
            title="Тем ще немає"
            description="Структуруйте курс по темах — кожна тема може мати кілька уроків і свій тест. Уроки без теми можна додавати нижче."
            action={!isReadOnly && (
              <Button size="sm" onClick={openCreateTopic} leftIcon={<Plus className="h-3.5 w-3.5" />}>
                Додати першу тему
              </Button>
            )}
          />
        ) : (
          <SortableContext items={topicIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {topics.map((topic) => (
                <TopicCard key={topic.id} topic={topic} lessons={lessonsFor(topic.id)} isReadOnly={isReadOnly}
                  isExpanded={expanded.has(topic.id)} onToggle={() => toggleExpand(topic.id)}
                  onEdit={() => openEditTopic(topic)} onDelete={() => setPendingDeleteTopic(topic)}
                  onTest={() => setTestTopic(topic)} onAssign={() => setAssignTopic(topic)}
                  onAddLesson={() => openCreateLesson(topic.id)}
                  onEditLesson={openEditLesson} onDeleteLesson={setPendingDeleteLesson} onLessonTest={setLessonTest} />
              ))}
            </div>
          </SortableContext>
        )}

        <div className="mt-1">
          <UnassignedSection lessons={unassignedLessons} isReadOnly={isReadOnly}
            isExpanded={expanded.has(UNASSIGNED)} onToggle={() => toggleExpand(UNASSIGNED)}
            onAddLesson={() => openCreateLesson(UNASSIGNED)}
            onEditLesson={openEditLesson} onDeleteLesson={setPendingDeleteLesson} onLessonTest={setLessonTest} />
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeTopic && <TopicGhost topic={activeTopic} lessonsCount={lessonsFor(activeTopic.id).length} />}
          {activeLesson && <RowGhost lesson={activeLesson} />}
        </DragOverlay>
      </DndContext>

      {/* Модалка теми */}
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

      <ConfirmDialog isOpen={!!pendingDeleteTopic} title="Видалити тему?"
        description={`Тема «${pendingDeleteTopic?.title}» буде видалена. Уроки залишаться без теми.`}
        confirmLabel="Так, видалити" isDanger isLoading={isDeletingTopic}
        onConfirm={handleDeleteTopic} onCancel={() => setPendingDeleteTopic(null)} />

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

      {/* Модалка уроку */}
      <Modal isOpen={lessonModal.open} onClose={() => setLessonModal({ open: false, editing: null, containerId: null })}
        title={lessonModal.editing ? "Редагувати урок" : "Новий урок"}
        description={lessonModal.editing ? undefined : "Порядок можна змінити перетягуванням після збереження."}>
        <form onSubmit={handleLessonSubmit} className="flex flex-col gap-4">
          <TextField label="Назва уроку" required minLength={2} maxLength={255}
            placeholder="Вступ до теми..." value={lessonForm.title}
            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
          <SelectField label="Тип контенту" value={lessonForm.type}
            onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value as LessonType })}>
            <option value="text">📝 Текст</option>
            <option value="video">🎬 Відео</option>
            <option value="pdf">📄 PDF</option>
          </SelectField>
          {lessonForm.type === "text" && (
            <TextAreaField label="Текст уроку" rows={6} placeholder="Введіть навчальний матеріал..."
              value={lessonForm.content ?? ""} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} />
          )}
          {lessonForm.type === "video" && (
            <TextField label="URL відео" type="url" placeholder="https://youtube.com/watch?v=…"
              hint="YouTube, Vimeo або пряме посилання" value={lessonForm.videoUrl ?? ""}
              onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })} />
          )}
          {lessonForm.type === "pdf" && (
            <TextField label="URL PDF-файлу" type="url" placeholder="https://…/document.pdf"
              value={lessonForm.pdfUrl ?? ""} onChange={(e) => setLessonForm({ ...lessonForm, pdfUrl: e.target.value })} />
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1"
              onClick={() => setLessonModal({ open: false, editing: null, containerId: null })}>Скасувати</Button>
            <Button type="submit" isLoading={isSavingLesson} className="flex-1">
              {lessonModal.editing ? "Зберегти" : "Додати урок"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!pendingDeleteLesson}
        title="Видалити урок?"
        description={`«${pendingDeleteLesson?.title}» та прогрес студентів буде видалено незворотно.`}
        confirmLabel="Так, видалити" isDanger isLoading={isDeletingLesson}
        onConfirm={handleDeleteLesson} onCancel={() => setPendingDeleteLesson(null)} />

      {lessonTest && (
        <LessonTestModal lessonId={lessonTest.id} lessonTitle={lessonTest.title}
          isOpen={!!lessonTest} onClose={() => setLessonTest(null)} isReadOnly={isReadOnly} />
      )}
    </div>
  );
}
