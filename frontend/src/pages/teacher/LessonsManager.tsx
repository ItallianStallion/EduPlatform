import { useEffect, useState, type FormEvent } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, FileQuestion, FileText, PlayCircle } from "lucide-react";
import { lessonsApi, type LessonUpsertPayload } from "../../api/lessons";
import type { Lesson, LessonType } from "../../types";
import { EmptyState, Badge, SkeletonList } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField, SelectField } from "../../components/FormField";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

const ICONS: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, pdf: FileText };
const EMPTY: LessonUpsertPayload = { title: "", type: "text", content: "", videoUrl: "", pdfUrl: "" };

// ── Sortable row ──────────────────────────────────────────────────
function SortableRow({ lesson, index, isReadOnly, onEdit, onDelete, onTest }: {
  lesson: Lesson; index: number; isReadOnly: boolean;
  onEdit: (l: Lesson) => void; onDelete: (l: Lesson) => void; onTest: (l: Lesson) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id, disabled: isReadOnly,
  });
  const Icon = ICONS[lesson.type] ?? FileText;

  return (
    <li ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="group flex items-center gap-2.5 px-4 py-3 hover:bg-paper-sunken/60 transition-colors">
      {!isReadOnly ? (
        <button {...attributes} {...listeners}
          className="drag-handle shrink-0 rounded-md p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Перетягнути">
          <GripVertical className="h-4 w-4" />
        </button>
      ) : <div className="w-6 shrink-0" />}

      <span className="font-mono text-[11px] text-slate-light w-5 text-right shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-light" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{lesson.title}</span>
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
              aria-label="Редагувати">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(lesson)}
              className="rounded-lg p-1.5 text-coral-dark hover:bg-coral/8 transition-colors"
              aria-label="Видалити">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function RowGhost({ lesson }: { lesson: Lesson }) {
  const Icon = ICONS[lesson.type] ?? FileText;
  return (
    <div className="dnd-dragging flex items-center gap-2.5 rounded-xl border border-line bg-paper-raised px-4 py-3">
      <GripVertical className="h-4 w-4 text-slate" />
      <Icon className="h-3.5 w-3.5 text-slate" />
      <span className="text-sm font-medium text-ink">{lesson.title}</span>
      <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export function LessonsManager({ courseId, isReadOnly = false }: { courseId: string; isReadOnly?: boolean }) {
  const { notify } = useToast();
  const [lessons, setLessons]     = useState<Lesson[] | null>(null);
  const [editing, setEditing]     = useState<Lesson | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState<LessonUpsertPayload>(EMPTY);
  const [isSaving, setIsSaving]   = useState(false);
  const [pendingDel, setPendingDel] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testLesson, setTestLesson] = useState<Lesson | null>(null);
  const [activeId, setActiveId]     = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function reload() {
    lessonsApi.listByCourse(courseId)
      .then((d) => setLessons(d.slice().sort((a, b) => a.order - b.order)))
      .catch((err) => notify(getErrorMessage(err), "error"));
  }
  useEffect(reload, [courseId]); // eslint-disable-line

  function openCreate() { setEditing(null); setForm(EMPTY); setModalOpen(true); }
  function openEdit(l: Lesson) {
    setEditing(l);
    setForm({ title: l.title, type: l.type, content: l.content ?? "", videoUrl: l.videoUrl ?? "", pdfUrl: l.pdfUrl ?? "", order: l.order });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setIsSaving(true);
    try {
      const p: LessonUpsertPayload = {
        title: form.title, type: form.type,
        content:  form.type === "text"  ? form.content  : null,
        videoUrl: form.type === "video" ? form.videoUrl : null,
        pdfUrl:   form.type === "pdf"   ? form.pdfUrl   : null,
      };
      if (editing) {
        await lessonsApi.update(editing.id, p);
      } else {
        await lessonsApi.create(courseId, p);
      }
      notify(editing ? "Урок оновлено" : "Урок додано", "success");
      setModalOpen(false); reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsSaving(false); }
  }

  async function handleDelete() {
    if (!pendingDel) return; setIsDeleting(true);
    try {
      await lessonsApi.remove(pendingDel.id);
      notify("Урок видалено", "success"); setPendingDel(null); reload();
    } catch (err) { notify(getErrorMessage(err), "error"); }
    finally { setIsDeleting(false); }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id || !lessons) return;
    const oi = lessons.findIndex((l) => l.id === active.id);
    const ni = lessons.findIndex((l) => l.id === over.id);
    if (oi === -1 || ni === -1) return;
    const reordered = arrayMove(lessons, oi, ni).map((l, i) => ({ ...l, order: i }));
    setLessons(reordered);
    try {
      await Promise.all(reordered.map((l) => lessonsApi.update(l.id, { order: l.order })));
    } catch (err) { notify(getErrorMessage(err), "error"); reload(); }
  }

  const activeLesson = activeId ? lessons?.find((l) => l.id === activeId) : null;

  if (!lessons) return <SkeletonList rows={4} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Уроки курсу</h2>
          {lessons.length > 1 && !isReadOnly && (
            <p className="mt-0.5 text-xs text-slate">Перетягуйте рядки щоб змінити порядок</p>
          )}
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Додати урок
          </Button>
        )}
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          title="Уроків ще немає"
          description="Додайте перший урок, щоб почати наповнення курсу."
          action={!isReadOnly && (
            <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Додати перший урок
            </Button>
          )}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}>
          <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ol className="overflow-hidden rounded-2xl border border-line bg-paper-raised divide-y divide-line">
              {lessons.map((l, i) => (
                <SortableRow key={l.id} lesson={l} index={i} isReadOnly={isReadOnly}
                  onEdit={openEdit} onDelete={setPendingDel} onTest={setTestLesson} />
              ))}
            </ol>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {activeLesson && <RowGhost lesson={activeLesson} />}
          </DragOverlay>
        </DndContext>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? "Редагувати урок" : "Новий урок"}
        description={editing ? undefined : "Порядок можна змінити перетягуванням після збереження."}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField label="Назва уроку" required minLength={2} maxLength={255}
            placeholder="Вступ до теми..." value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <SelectField label="Тип контенту" value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as LessonType })}>
            <option value="text">📝 Текст</option>
            <option value="video">🎬 Відео</option>
            <option value="pdf">📄 PDF</option>
          </SelectField>
          {form.type === "text" && (
            <TextAreaField label="Текст уроку" rows={6} placeholder="Введіть навчальний матеріал..."
              value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          )}
          {form.type === "video" && (
            <TextField label="URL відео" type="url" placeholder="https://youtube.com/watch?v=…"
              hint="YouTube, Vimeo або пряме посилання" value={form.videoUrl ?? ""}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
          )}
          {form.type === "pdf" && (
            <TextField label="URL PDF-файлу" type="url" placeholder="https://…/document.pdf"
              value={form.pdfUrl ?? ""} onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })} />
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setModalOpen(false)}>Скасувати</Button>
            <Button type="submit" isLoading={isSaving} className="flex-1">
              {editing ? "Зберегти" : "Додати урок"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!pendingDel}
        title="Видалити урок?"
        description={`«${pendingDel?.title}» та прогрес студентів буде видалено незворотно.`}
        confirmLabel="Так, видалити" isDanger isLoading={isDeleting}
        onConfirm={handleDelete} onCancel={() => setPendingDel(null)} />

      {testLesson && (
        <LessonTestModal lessonId={testLesson.id} lessonTitle={testLesson.title}
          isOpen={!!testLesson} onClose={() => setTestLesson(null)} isReadOnly={isReadOnly} />
      )}
    </div>
  );
}
