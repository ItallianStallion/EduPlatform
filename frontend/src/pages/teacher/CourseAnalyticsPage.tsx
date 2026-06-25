import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Users, TrendingUp, Percent, Layers } from "lucide-react";
import { analyticsApi } from "../../api/analytics";
import type { CourseAnalytics, CourseStudent } from "../../types";
import { Spinner, EmptyState, Card } from "../../components/ui";
import { formatBalance, formatDate, getErrorMessage } from "../../utils/helpers";

export function CourseAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [students, setStudents] = useState<CourseStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([analyticsApi.courseAnalytics(id), analyticsApi.courseStudents(id)])
      .then(([a, s]) => {
        setAnalytics(a);
        setStudents(s);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  if (error) return <EmptyState title="Не вдалося завантажити аналітику курсу" description={error} />;
  if (!analytics || !students) return <Spinner />;

  const stats = [
    { label: "Студентів", value: analytics.students.total, icon: Users },
    { label: "Середній прогрес", value: `${analytics.progress.averagePercentage}%`, icon: Percent },
    {
      label: "Блоків",
      value: `${analytics.blocks.total}${analytics.blocks.withTest ? ` · з тестом: ${analytics.blocks.withTest}` : ""}`,
      icon: Layers,
    },
    { label: "Дохід", value: formatBalance(analytics.revenue.teacherNet), icon: TrendingUp },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Аналітика курсу</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <s.icon className="h-4 w-4 text-gold-dark" />
            <p className="mt-2 font-mono text-xl font-semibold text-ink">{s.value}</p>
            <p className="text-xs text-slate">{s.label}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 font-display text-lg text-ink">Студенти</h2>
      {students.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Ще немає записаних студентів" />
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-paper-raised">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Студент</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Записаний</th>
                <th className="px-4 py-3">Прогрес</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.student.id}>
                  <td className="px-4 py-3 font-medium text-ink">
                    {s.student.name} {s.student.surname}
                  </td>
                  <td className="px-4 py-3 text-slate">{s.student.email}</td>
                  <td className="px-4 py-3 text-slate">{formatDate(s.enrolledAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-ink/10">
                        <div className="h-1.5 rounded-full bg-gold" style={{ width: `${s.percentage}%` }} />
                      </div>
                      <span className="font-mono text-xs text-ink">{s.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
