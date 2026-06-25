import { NavLink, Outlet, Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, GraduationCap, Users, ShieldCheck,
  BookOpenCheck, Library, BarChart2, ChevronRight,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { profilesApi } from "../api/profiles";
import { initials, ROLE_LABELS } from "../utils/helpers";

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; }

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  student: [
    { to: "/dashboard",  label: "Дашборд",   icon: LayoutDashboard, end: true },
    { to: "/my-courses", label: "Мої курси", icon: GraduationCap },
  ],
  teacher: [
    { to: "/teacher",           label: "Мої курси",  icon: BookOpenCheck, end: true },
    { to: "/teacher/analytics", label: "Аналітика",  icon: BarChart2 },
    { to: "/my-courses",        label: "Навчання",   icon: GraduationCap },
  ],
  admin: [
    { to: "/admin/users",   label: "Користувачі",       icon: Users },
    { to: "/admin/courses", label: "Модерація курсів",  icon: ShieldCheck },
  ],
};

export function DashboardLayout() {
  const { user, isAuthenticated } = useAuth();
  const items = NAV_BY_ROLE[user?.role ?? "student"] ?? [];
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setAvatar(null); return; }
    profilesApi.myProfile().then((p) => setAvatar(p.avatar)).catch(() => setAvatar(null));
  }, [isAuthenticated]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-8 sm:px-6">

        {/* ── Sidebar ─────────────────────────────── */}
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-24 flex flex-col gap-5">

            {/* User card */}
            {user && (
              <Link to="/profile"
                className="group flex items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3.5 transition-all hover:border-line-strong hover:shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink font-mono text-sm font-semibold text-paper">
                  {avatar
                    ? <img src={avatar} alt="" className="h-full w-full object-cover" />
                    : initials(user.name, user.surname)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.name} {user.surname}</p>
                  <p className="text-xs text-slate">{ROLE_LABELS[user.role]}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-light shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}

            {/* Nav */}
            <nav aria-label="Навігація кабінету">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-light">
                Навігація
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end}
                    className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
                <div className="my-2 border-t border-line" />
                <NavLink to="/catalog"
                  className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                  <Library className="h-4 w-4 shrink-0" />
                  Каталог курсів
                </NavLink>
              </div>
            </nav>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────── */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
