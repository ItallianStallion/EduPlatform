import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, LogOut, Menu, User as UserIcon, X, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { profilesApi } from "../api/profiles";
import { initials, ROLE_LABELS } from "../utils/helpers";

const navLinkCls = ({ isActive }: { isActive: boolean }) =>
  `relative text-sm font-medium transition-colors px-1 py-0.5 ${
    isActive
      ? "text-ink after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-gold-dark after:rounded-full"
      : "text-slate hover:text-ink"
  }`;

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatar, setAvatar]       = useState<string | null>(null);
  const [scrolled, setScrolled]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setAvatar(null); return; }
    profilesApi.myProfile().then((p) => setAvatar(p.avatar)).catch(() => setAvatar(null));
  }, [isAuthenticated]);

  const dashboardPath =
    user?.role === "teacher" ? "/teacher" :
    user?.role === "admin"   ? "/admin"   : "/dashboard";

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <header className={`sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md transition-shadow duration-200 ${scrolled ? "shadow-sm shadow-ink/5" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">

        {/* Logo */}
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink transition-colors group-hover:bg-ink-light">
            <BookOpen className="h-4 w-4 text-gold" />
          </div>
          <span className="font-display text-[20px] italic font-semibold text-ink">EduPlatform</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/catalog" className={navLinkCls} end>Каталог</NavLink>
          {isAuthenticated && (
            <NavLink to={dashboardPath} className={navLinkCls}>
              {user?.role === "teacher" ? "Мої курси" : user?.role === "admin" ? "Адмінпанель" : "Мій кабінет"}
            </NavLink>
          )}
        </nav>

        {/* Desktop right */}
        <div className="hidden items-center gap-3 md:flex">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="text-sm font-semibold text-slate transition-colors hover:text-ink">
                Увійти
              </Link>
              <Link to="/register"
                className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper transition-all hover:bg-ink-light active:scale-[0.98]">
                Реєстрація
              </Link>
            </>
          ) : (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-ink/6"
                aria-expanded={menuOpen} aria-haspopup="menu">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-mono text-[11px] font-semibold text-paper">
                  {avatar
                    ? <img src={avatar} alt="" className="h-full w-full object-cover" />
                    : initials(user!.name, user!.surname)}
                </span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-ink leading-tight">{user!.name}</p>
                  <p className="text-[10px] text-slate leading-tight">{ROLE_LABELS[user!.role]}</p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-paper-raised py-1.5 shadow-lg shadow-ink/8">
                    <div className="px-3.5 py-2.5 border-b border-line mb-1">
                      <p className="text-xs font-semibold text-ink truncate">{user!.name} {user!.surname}</p>
                      <p className="text-[11px] text-slate truncate">{user!.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-ink/5 transition-colors">
                      <UserIcon className="h-3.5 w-3.5 text-slate" /> Профіль
                    </Link>
                    <Link to={dashboardPath} onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-ink/5 transition-colors">
                      <LayoutDashboard className="h-3.5 w-3.5 text-slate" /> Кабінет
                    </Link>
                    <div className="my-1 border-t border-line" />
                    <button onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-coral-dark hover:bg-coral/5 transition-colors">
                      <LogOut className="h-3.5 w-3.5" /> Вийти
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mobile burger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-ink/6 md:hidden transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={mobileOpen}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="flex flex-col gap-0.5 border-t border-line px-4 py-3 md:hidden">
          <Link to="/catalog" onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/5">
            <BookOpen className="h-4 w-4 text-slate" /> Каталог
          </Link>
          {isAuthenticated ? (
            <>
              <Link to={dashboardPath} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/5">
                <LayoutDashboard className="h-4 w-4 text-slate" /> Кабінет
              </Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/5">
                <UserIcon className="h-4 w-4 text-slate" /> Профіль
              </Link>
              <div className="my-1 border-t border-line" />
              <button onClick={handleLogout}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-coral-dark hover:bg-coral/5">
                <LogOut className="h-4 w-4" /> Вийти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/5">
                Увійти
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}
                className="mt-1 flex items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper">
                Реєстрація
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
