import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { coursesApi } from "../../api/courses";
import { categoriesApi } from "../../api/categories";
import type { Category, Course, PriceFilter, SortBy } from "../../types";
import { Pagination } from "../../components/Pagination";
import { CourseCard } from "../../components/CourseCard";
import { SkeletonCard, EmptyState } from "../../components/ui";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { getErrorMessage } from "../../utils/helpers";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "popular",    label: "Популярні" },
  { value: "newest",     label: "Нові" },
  { value: "price_asc",  label: "Дешевші" },
  { value: "price_desc", label: "Дорожчі" },
];

const PRICE_OPTIONS = [
  { value: "any",  label: "Будь-яка ціна" },
  { value: "free", label: "Безкоштовні" },
  { value: "paid", label: "Платні" },
];

// ── Filter chip ───────────────────────────────────────────────────
function FilterSelect<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const isDefault = value === options[0].value;

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`appearance-none cursor-pointer rounded-xl border py-2 pl-3.5 pr-8 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gold/30 ${
          isDefault
            ? "border-line bg-paper-raised text-slate hover:border-line-strong hover:text-ink"
            : "border-gold/40 bg-gold/6 text-gold-dark"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-current opacity-60" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export function CourseCatalogPage() {
  const [search, setSearch]     = useState("");
  const debouncedSearch         = useDebouncedValue(search, 400);
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice]       = useState<PriceFilter>("any");
  const [sortBy, setSortBy]     = useState<SortBy>("popular");
  const [page, setPage]         = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult]     = useState<{ items: Course[]; totalPages: number; total?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => { setPage(1); }, [debouncedSearch, categoryId, price, sortBy]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length > 0 && q.length < 3) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    coursesApi
      .list({ q: q.length >= 3 ? q : undefined, categoryId: categoryId || undefined, price, sortBy, page, limit: 12 })
      .then((data) => {
        if (cancelled) return;
        setResult({ items: data.items, totalPages: data.totalPages, total: (data as { total?: number }).total });

      })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedSearch, categoryId, price, sortBy, page]);

  const hasFilters = !!search || !!categoryId || price !== "any" || sortBy !== "popular";

  function clearFilters() {
    setSearch(""); setCategoryId(""); setPrice("any"); setSortBy("popular");
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

      {/* Hero header */}
      <div className="mb-10">
        <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">
          Каталог курсів
        </h1>
        <p className="mt-3 max-w-xl text-base text-slate leading-relaxed">
          Від коротких практичних уроків до повноцінних програм з тестами — знайдіть свій курс.
        </p>
      </div>

      {/* Search + filters bar */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">

        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук курсів..."
            aria-label="Пошук курсів"
            className="w-full rounded-2xl border border-line bg-paper-raised py-3 pl-11 pr-10 text-sm text-ink placeholder:text-slate/60 transition-all focus:border-gold-dark focus:outline-none focus:ring-3 focus:ring-gold/20 hover:border-line-strong"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate hover:text-ink transition-colors"
              aria-label="Очистити пошук"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <div className="relative">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`appearance-none cursor-pointer rounded-xl border py-2 pl-3.5 pr-8 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gold/30 ${
                categoryId
                  ? "border-gold/40 bg-gold/6 text-gold-dark"
                  : "border-line bg-paper-raised text-slate hover:border-line-strong hover:text-ink"
              }`}
            >
              <option value="">Усі категорії</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
          </div>

          <FilterSelect<PriceFilter>
            value={price}
            options={PRICE_OPTIONS as { value: PriceFilter; label: string }[]}
            onChange={setPrice}
          />
          <FilterSelect<SortBy>
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={setSortBy}
          />

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-slate transition-colors hover:border-coral/30 hover:bg-coral/5 hover:text-coral-dark"
            >
              <X className="h-3 w-3" /> Скинути
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {!isLoading && result && result.items.length > 0 && (
        <p className="mb-5 text-xs text-slate">
          {result.total !== undefined
            ? `Знайдено ${result.total} курсів`
            : `${result.items.length} курсів на сторінці`}
          {search && <span className="text-ink"> за запитом «{search}»</span>}
        </p>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <EmptyState title="Не вдалося завантажити каталог" description={error} />
      )}

      {/* Empty */}
      {!isLoading && !error && result?.items.length === 0 && (
        <EmptyState
          title="Курсів не знайдено"
          description={
            hasFilters
              ? "Спробуйте змінити фільтри або пошуковий запит."
              : "Каталог поки порожній — повертайтеся пізніше."
          }
          action={
            hasFilters && (
              <button
                onClick={clearFilters}
                className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5 transition-colors"
              >
                Скинути фільтри
              </button>
            )
          }
        />
      )}

      {/* Grid */}
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
