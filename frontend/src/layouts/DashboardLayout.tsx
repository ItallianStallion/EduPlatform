import { NavLink, Outlet } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  ShieldCheck,
  BookOpenCheck,
  Library,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  student: [
    { to: "/dashboard", label: "Дашборд", icon: LayoutDashboard, end: true },
    { to: "/my-courses", label: "Мої курси", icon: GraduationCap },
  ],
  teacher: [
    { to: "/teacher", label: "Мої курси", icon: BookOpenCheck, end: true },
    { to: "/teacher/analytics", label: "Аналітика", icon: LayoutDashboard },
    { to: "/my-courses", label: "Навчання", icon: GraduationCap },
  ],
  admin: [
    { to: "/admin/users", label: "Користувачі", icon: Users },
    { to: "/admin/courses", label: "Модерація курсів", icon: ShieldCheck },
  ],
};

export function DashboardLayout() {
  const { user } = useAuth();
  const items = NAV_BY_ROLE[user?.role ?? "student"] ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24 flex flex-col gap-1">
            <p className="px-3 pb-2 font-mono text-xs uppercase tracking-wide text-slate">
              Кабінет
            </p>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-ink text-paper" : "text-ink/80 hover:bg-ink/5"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/"
              className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
            >
              <Library className="h-4 w-4" />
              Каталог курсів
            </NavLink>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
