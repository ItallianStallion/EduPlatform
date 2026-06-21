import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { profilesApi } from "../api/profiles";
import { initials, ROLE_LABELS } from "../utils/helpers";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? "text-ink" : "text-slate hover:text-ink"}`;

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  // User з AuthContext не містить avatar (це окрема сутність UserProfile),
  // тож підвантажуємо профіль окремо лише заради аватарки в меню.
  useEffect(() => {
    if (!isAuthenticated) {
      setAvatar(null);
      return;
    }
    profilesApi
      .myProfile()
      .then((p) => setAvatar(p.avatar))
      .catch(() => setAvatar(null));
  }, [isAuthenticated]);

  const dashboardPath = user?.role === "teacher" ? "/teacher" : user?.role === "admin" ? "/admin" : "/dashboard";

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gold-dark" />
          <span className="font-display text-xl italic text-ink">EduPlatform</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className={navLinkClass} end>
            Каталог
          </NavLink>
          {isAuthenticated && (
            <NavLink to={dashboardPath} className={navLinkClass}>
              {user?.role === "teacher" ? "Мої курси" : user?.role === "admin" ? "Адмінпанель" : "Мої курси"}
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="text-sm font-medium text-slate hover:text-ink">
                Увійти
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold-dark"
              >
                Реєстрація
              </Link>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2 hover:bg-ink/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-mono text-xs font-medium text-paper">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(user!.name, user!.surname)
                  )}
                </span>
                <span className="text-sm font-medium text-ink">{user!.name}</span>
                <ChevronDown className="h-4 w-4 text-slate" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-line bg-paper-raised py-1.5 shadow-lg shadow-ink/5">
                    <div className="px-3 py-2 text-xs text-slate">
                      {ROLE_LABELS[user!.role]} · {user!.email}
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-ink/5"
                    >
                      <UserIcon className="h-4 w-4" /> Профіль
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-coral-dark hover:bg-coral/5"
                    >
                      <LogOut className="h-4 w-4" /> Вийти
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button className="text-ink md:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Меню">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
          <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-md px-2 py-2 text-sm text-ink hover:bg-ink/5">
            Каталог
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to={dashboardPath}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-sm text-ink hover:bg-ink/5"
              >
                Мій кабінет
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-sm text-ink hover:bg-ink/5"
              >
                Профіль
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md px-2 py-2 text-left text-sm text-coral-dark hover:bg-coral/5"
              >
                Вийти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-md px-2 py-2 text-sm text-ink hover:bg-ink/5">
                Увійти
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="rounded-md px-2 py-2 text-sm text-ink hover:bg-ink/5">
                Реєстрація
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
