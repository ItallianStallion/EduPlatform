import { Outlet } from "react-router-dom";
import { Navbar } from "../components/Navbar";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-slate">
        EduPlatform · навчальна платформа для студентів і викладачів
      </footer>
    </div>
  );
}
