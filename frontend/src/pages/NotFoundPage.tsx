import { Link } from "react-router-dom";
import { Button } from "../components/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-sm text-slate">404</p>
      <h1 className="font-display text-2xl text-ink">Сторінку не знайдено</h1>
      <p className="max-w-sm text-sm text-slate">Можливо, посилання застаріле або сторінку було переміщено.</p>
      <Link to="/">
        <Button variant="ghost" className="mt-2">
          На головну
        </Button>
      </Link>
    </div>
  );
}
