import { useEffect, useState, type FormEvent } from "react";
import { GripVertical, Pencil, Plus, Trash2, ArrowUp, ArrowDown, FileQuestion } from "lucide-react";
import { lessonsApi, type LessonUpsertPayload } from "../../api/lessons";
import type { Lesson, LessonType } from "../../types";
import { Spinner, EmptyState, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { TextField, TextAreaField, SelectField } from "../../components/FormField";
import { getErrorMessage, LESSON_TYPE_LABELS } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";
import { LessonTestModal } from "./LessonTestModal";

const EMPTY_FORM: LessonUpsertPayload = { title: "", type: "text", content: "", videoUrl: "", pdfUrl: "" };

export function LessonsManager({ courseId, isReadOnly = false }: { courseId: string; isReadOnly?: boolean }) {
  const { notify } = useToast();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<LessonUpsertPayload>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testLesson, setTestLesson] = useState<Lesson | null>(null);

  function reload() {
    lessonsApi
      .listByCourse(courseId)
      .then((data) => setLessons(data.slice().sort((a, b) => a.order - b.order)))
      .catch((err) => notify(getErrorMessage(err), "error"));
  }

  useEffect(reload, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEdit(lesson: Lesson) {
    setEditing(lesson);
    setForm({
      title: lesson.title,
      type: lesson.type,
      content: lesson.content ?? "",
      videoUrl: lesson.videoUrl ?? "",
      pdfUrl: lesson.pdfUrl ?? "",
      order: lesson.order,
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: LessonUpsertPayload = {
        title: form.title,
        type: form.type,
        content: form.type === "text" ? form.content : null,
        videoUrl: form.type === "video" ? form.videoUrl : null,
        pdfUrl: form.type === "pdf" ? form.pdfUrl : null,
      };
      if (editing) {
        await lessonsApi.update(editing.id, payload);
        notify("Урок оновлено", "success");
      } else {
        await lessonsApi.create(courseId, payload);
        notify("Урок додано", "success");
      }
      setIsModalOpen(false);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await lessonsApi.remove(pendingDelete.id);
      notify("Урок видалено", "success");
      setPendingDelete(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  async function moveLesson(lesson: Lesson, direction: -1 | 1) {
    if (!lessons) return;
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const swapWith = lessons[idx + direction];
    if (!swapWith) return;
    try {
      await Promise.all([
        lessonsApi.update(lesson.id, { order: swapWith.order }),
        lessonsApi.update(swapWith.id, { order: lesson.order }),
      ]);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    }
  }

  if (!lessons) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Уроки курсу</h2>
        {!isReadOnly && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Додати урок
          </Button>
        )}
      </div>

      {lessons.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Уроків ще немає" description="Додайте перший урок, щоб почати наповнення курсу." />
        </div>
      ) : (
        <ol className="mt-4 flex flex-col divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {lessons.map((lesson, idx) => (
            <li key={lesson.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="h-4 w-4 shrink-0 text-slate/40" />
              <span className="font-mono text-xs text-slate">{String(idx + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{lesson.title}</span>
              <Badge>{LESSON_TYPE_LABELS[lesson.type]}</Badge>
              <div className="flex items-center gap-1">
                {!isReadOnly && (
                  <>
                    <button
                      onClick={() => moveLesson(lesson, -1)}
                      disabled={idx === 0}
                      className="rounded p-1.5 text-slate hover:bg-ink/5 disabled:opacity-30"
                      aria-label="Підняти вище"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveLesson(lesson, 1)}
                      disabled={idx === lessons.length - 1}
                      className="rounded p-1.5 text-slate hover:bg-ink/5 disabled:opacity-30"
                      aria-label="Опустити нижче"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setTestLesson(lesson)}
                  className="rounded p-1.5 text-slate hover:bg-ink/5"
                  aria-label="Тест уроку"
                  title="Тест уроку"
                >
                  <FileQuestion className="h-3.5 w-3.5" />
                </button>
                {!isReadOnly && (
                  <>
                    <button
                      onClick={() => openEdit(lesson)}
                      className="rounded p-1.5 text-slate hover:bg-ink/5"
                      aria-label="Редагувати"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(lesson)}
                      className="rounded p-1.5 text-coral-dark hover:bg-coral/5"
                      aria-label="Видалити"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Редагувати урок" : "Новий урок"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Назва уроку"
            required
            minLength={2}
            maxLength={255}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <SelectField
            label="Тип уроку"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as LessonType })}
          >
            <option value="text">Текст</option>
            <option value="video">Відео</option>
            <option value="pdf">PDF</option>
          </SelectField>
          {form.type === "text" && (
            <TextAreaField
              label="Текст уроку"
              rows={6}
              value={form.content ?? ""}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          )}
          {form.type === "video" && (
            <TextField
              label="URL відео"
              placeholder="https://youtube.com/watch?v=…"
              value={form.videoUrl ?? ""}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            />
          )}
          {form.type === "pdf" && (
            <TextField
              label="URL PDF"
              placeholder="https://…"
              value={form.pdfUrl ?? ""}
              onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
            />
          )}
          <Button type="submit" isLoading={isSaving} className="mt-1">
            {editing ? "Зберегти зміни" : "Додати урок"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Видалити урок?"
        description={`Урок «${pendingDelete?.title}» та прогрес студентів по ньому буде видалено незворотно.`}
        confirmLabel="Видалити"
        isDanger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {testLesson && (
        <LessonTestModal
          lessonId={testLesson.id}
          lessonTitle={testLesson.title}
          isOpen={!!testLesson}
          onClose={() => setTestLesson(null)}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
