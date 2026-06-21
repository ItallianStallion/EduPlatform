import { Link } from "react-router-dom";
import { BookOpen, Video, FileText, Award, TrendingUp, Phone, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  const dashboardPath =
    user?.role === "teacher" ? "/teacher" :
    user?.role === "admin"   ? "/admin/users" :
    "/my-courses";

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-dark">
          <BookOpen className="h-3.5 w-3.5" />
          Сучасна освітня платформа
        </span>

        <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl">
          Навчайся. Розвивайся.{" "}
          <span className="italic text-gold-dark">Досягай більшого.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-slate">
          <em className="font-medium text-ink not-italic">EduPlatform</em> — якісні курси від
          провідних викладачів. Проходь уроки у власному темпі, відстежуй прогрес і отримуй
          знання у зручний час.
        </p>

        <div className="mt-10 flex items-center gap-4">
          {isAuthenticated ? (
            <Link
              to={dashboardPath}
              className="flex items-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink-light transition-colors"
            >
              Мій кабінет <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              to="/register"
              className="flex items-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink-light transition-colors"
            >
              Почати навчання <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link
            to="/catalog"
            className="rounded-md border border-line px-6 py-3 text-sm font-medium text-ink hover:bg-ink/5 transition-colors"
          >
            Переглянути курси
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: "99+", label: "Студентів" },
            { value: "12",  label: "Курсів" },
            { value: "5",   label: "Викладачів" },
            { value: "98%", label: "Завершують" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-line bg-paper-raised px-6 py-4 text-center"
            >
              <div className="font-display text-2xl font-semibold text-gold-dark">{s.value}</div>
              <div className="mt-0.5 text-xs text-slate">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="border-t border-line bg-paper-raised py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-center text-2xl font-semibold text-ink">
            Можливості платформи
          </h2>
          <p className="mt-2 text-center text-sm text-slate">
            Усе що потрібно для ефективного навчання
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Video className="h-5 w-5 text-gold-dark" />,
                title: "Відеолекції",
                desc: "Записані лекції від викладачів університету",
              },
              {
                icon: <FileText className="h-5 w-5 text-teal-dark" />,
                title: "Тести та завдання",
                desc: "Онлайн-тестування з автоматичною перевіркою",
              },
              {
                icon: <Award className="h-5 w-5 text-coral-dark" />,
                title: "Сертифікати",
                desc: "Електронні сертифікати після завершення курсу",
              },
              {
                icon: <TrendingUp className="h-5 w-5 text-ink-light" />,
                title: "Прогрес навчання",
                desc: "Відстеження прогресу по кожному курсу",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-line bg-paper p-6"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-ink/5">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA / Contact ─────────────────────────────────── */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold leading-tight text-paper">
                Виникли питання?<br />Зв'яжіться з нами!
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-paper/70">
              Зв'яжіться з нами вже сьогодні — і ми зробимо ваш досвід на платформі
              максимально зручним та ефективним.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-paper/10 bg-paper/5 p-5 text-center">
              <p className="text-xs text-paper/50">Номер телефону</p>
              <a
                href="tel:+380974821953"
                className="mt-1 flex items-center justify-center gap-2 text-base font-semibold text-paper hover:text-gold transition-colors"
              >
                <Phone className="h-4 w-4" />
                +380 97 482 19 53
              </a>
            </div>
            <div className="rounded-lg border border-paper/10 bg-paper/5 p-5 text-center">
              <p className="text-xs text-paper/50">Електронна пошта</p>
              <a
                href="mailto:support@gmail.com"
                className="mt-1 flex items-center justify-center gap-2 text-base font-semibold text-paper hover:text-gold transition-colors"
              >
                <Mail className="h-4 w-4" />
                support@gmail.com
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
