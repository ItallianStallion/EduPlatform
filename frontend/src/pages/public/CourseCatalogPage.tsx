import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { categoriesApi } from "../../api/categories";
import type { Category, Course, PriceFilter, SortBy } from "../../types";
import { CourseCard } from "../../components/CourseCard";
import { Pagination } from "../../components/Pagination";
import { Spinner, EmptyState } from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { getErrorMessage } from "../../utils/helpers";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "popular", label: "Популярні" },
  { value: "newest", label: "Нові" },
  { value: "price_asc", label: "Дешевші спочатку" },
  { value: "price_desc", label: "Дорожчі спочатку" },
];

export function CourseCatalogPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState<PriceFilter>("any");
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<{ items: Course[]; totalPages: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch(() => setCategories([])); // довідник необов'язковий для роботи каталогу
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, price, sortBy]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length > 0 && q.length < 3) return; // бекенд однаково ігнорує короткі запити

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    coursesApi
      .list({
        q: q.length >= 3 ? q : undefined,
        categoryId: categoryId || undefined,
        price,
        sortBy,
        page,
        limit: 12,
      })
      .then((data) => {
        if (cancelled) return;
        setResult({ items: data.items, totalPages: data.totalPages });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
      })
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, categoryId, price, sortBy, page]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Каталог курсів</h1>
        <p className="mt-2 text-slate">
          Знайдіть курс від практикуючих викладачів — від коротких уроків до повноцінних програм з тестами.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук курсів (мінімум 3 символи)…"
            className="w-full rounded-md border border-line bg-paper-raised py-2.5 pl-9 pr-3 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-line bg-paper-raised px-3 py-2.5 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
        >
          <option value="">Усі категорії</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={price}
          onChange={(e) => setPrice(e.target.value as PriceFilter)}
          className="rounded-md border border-line bg-paper-raised px-3 py-2.5 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
        >
          <option value="any">Будь-яка ціна</option>
          <option value="free">Безкоштовні</option>
          <option value="paid">Платні</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-md border border-line bg-paper-raised px-3 py-2.5 text-sm focus:border-gold-dark focus:outline-none focus:ring-1 focus:ring-gold-dark"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <Spinner label="Шукаємо курси…" />}

      {!isLoading && error && (
        <EmptyState title="Не вдалося завантажити каталог" description={error} />
      )}

      {!isLoading && !error && result && result.items.length === 0 && (
        <EmptyState
          title="Курсів не знайдено"
          description="Спробуйте змінити пошуковий запит або фільтри."
        />
      )}

      {!isLoading && !error && result && result.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          <Pagination page={page} totalPages={result.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
