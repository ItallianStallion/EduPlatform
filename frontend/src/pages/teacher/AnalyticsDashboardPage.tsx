import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Wallet, TrendingUp, BookOpen } from "lucide-react";
import { analyticsApi } from "../../api/analytics";
import type { AnalyticsDashboard } from "../../types";
import { Spinner, EmptyState, Card, Badge } from "../../components/ui";
import { formatBalance, getErrorMessage } from "../../utils/helpers";

export function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi
      .dashboard()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Не вдалося завантажити аналітику" description={error} />;
  if (!data) return <Spinner />;

  const stats = [
    { label: "Студентів усього", value: data.summary.totalStudents, icon: Users },
    { label: "Дохід усього", value: formatBalance(data.summary.totalRevenue), icon: TrendingUp },
    { label: "Баланс", value: formatBalance(data.summary.teacherBalance), icon: Wallet },
    { label: "Курсів", value: data.summary.totalCourses, icon: BookOpen },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Аналітика</h1>
      <p className="mt-1 text-sm text-slate">Зведені показники по всіх ваших курсах.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <s.icon className="h-4 w-4 text-gold-dark" />
            <p className="mt-2 font-mono text-xl font-semibold text-ink">{s.value}</p>
            <p className="text-xs text-slate">{s.label}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 font-display text-lg text-ink">Курси</h2>
      {data.courses.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Ще немає даних по курсах" />
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-paper-raised">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Курс</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Студенти</th>
                <th className="px-4 py-3">Дохід</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.courses.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link to={`/teacher/courses/${c.id}/analytics`} className="font-medium text-ink hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.status === "published" ? "teal" : "coral"}>
                      {c.status === "published" ? "Опубліковано" : "Чернетка"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono">{c.students}</td>
                  <td className="px-4 py-3 font-mono">{formatBalance(c.revenue.teacherNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
