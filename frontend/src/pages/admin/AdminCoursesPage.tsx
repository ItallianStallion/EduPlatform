import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EyeOff } from "lucide-react";
import { adminApi } from "../../api/admin";
import type { Course, CourseStatus } from "../../types";
import { Spinner, EmptyState, Badge } from "../../components/ui";
import { Button } from "../../components/Button";
import { Pagination } from "../../components/Pagination";
import { ConfirmDialog } from "../../components/Modal";
import { formatPrice, getErrorMessage } from "../../utils/helpers";
import { useToast } from "../../context/ToastContext";

export function AdminCoursesPage() {
  const { notify } = useToast();
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: Course[]; totalPages: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUnpublish, setPendingUnpublish] = useState<Course | null>(null);
  const [isActing, setIsActing] = useState(false);

  function reload() {
    setIsLoading(true);
    adminApi
      .listCourses({ status: statusFilter || undefined, page, limit: 15 })
      .then((data) => setResult({ items: data.items, totalPages: data.totalPages }))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(reload, [statusFilter, page]);

  async function handleUnpublish() {
    if (!pendingUnpublish) return;
    setIsActing(true);
    try {
      await adminApi.unpublishCourse(pendingUnpublish.id);
      notify("Курс знято з публікації", "success");
      setPendingUnpublish(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Модерація курсів</h1>
      <p className="mt-1 text-sm text-slate">Усі курси платформи, незалежно від статусу.</p>

      <div className="mt-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CourseStatus | "")}
          className="rounded-md border border-line bg-paper-raised px-3 py-2.5 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
        >
          <option value="">Усі статуси</option>
          <option value="published">Опубліковані</option>
          <option value="draft">Чернетки</option>
        </select>
      </div>

      {isLoading && <Spinner />}
      {!isLoading && error && <EmptyState title="Не вдалося завантажити курси" description={error} />}
      {!isLoading && !error && result && result.items.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Курсів не знайдено" />
        </div>
      )}

      {!isLoading && !error && result && result.items.length > 0 && (
        <>
          <div className="mt-6 overflow-hidden rounded-lg border border-line bg-paper-raised">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Курс</th>
                  <th className="px-4 py-3">Викладач</th>
                  <th className="px-4 py-3">Ціна</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link to={`/courses/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {c.teacher ? `${c.teacher.name} ${c.teacher.surname}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatPrice(c.price)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={c.status === "published" ? "teal" : "coral"}>
                        {c.status === "published" ? "Опубліковано" : "Чернетка"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "published" && (
                        <Button size="sm" variant="danger" onClick={() => setPendingUnpublish(c)}>
                          <EyeOff className="h-3.5 w-3.5" /> Зняти з публікації
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={result.totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        isOpen={!!pendingUnpublish}
        title="Зняти курс з публікації?"
        description={`«${pendingUnpublish?.title}» стане недоступним у каталозі для студентів.`}
        confirmLabel="Зняти з публікації"
        isDanger
        isLoading={isActing}
        onConfirm={handleUnpublish}
        onCancel={() => setPendingUnpublish(null)}
      />
    </div>
  );
}
