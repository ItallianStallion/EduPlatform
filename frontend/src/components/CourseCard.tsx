import { Link } from "react-router-dom";
import { Users, BookOpen, BookMarked } from "lucide-react";
import type { Course } from "../types";
import { formatPrice } from "../utils/helpers";
import { Badge } from "./ui";

interface CourseCardProps {
  course: Course;
  compact?: boolean;
  progress?: number;
}

export function CourseCard({ course, compact = false, progress }: CourseCardProps) {
  const isFree = !course.price || Number(course.price) === 0;
  const hasProgress = typeof progress === "number";

  // Бекенд може віддавати кількість студентів як studentsCount (число)
  // або як enrollmentCount (рядок/число з SQL-агрегації) — підтримуємо обидва.
  const rawStudentsCount = course.studentsCount ?? course.enrollmentCount;
  const studentsCount =
    rawStudentsCount === undefined || rawStudentsCount === null
      ? null
      : Number(rawStudentsCount);

  const lessonsCount =
    course.lessonsCount === undefined || course.lessonsCount === null
      ? null
      : Number(course.lessonsCount);

  if (compact) {
    return (
      <Link to={`/courses/${course.id}`}
        className="group flex items-center gap-3 rounded-xl border border-line bg-paper-raised p-3 transition-all hover:border-line-strong hover:shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
          {course.coverImage
            ? <img src={course.coverImage} alt="" className="h-full w-full object-cover" />
            : <BookOpen className="h-5 w-5 text-ink/25" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{course.title}</p>
          {course.teacher && (
            <p className="truncate text-xs text-slate">{course.teacher.name} {course.teacher.surname}</p>
          )}
          {hasProgress && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="progress-bar flex-1">
                <div className={`progress-fill ${progress === 100 ? "bg-teal" : "bg-gold"}`}
                  style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] font-medium tabular-nums text-slate">{progress}%</span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-all duration-200 hover:border-line-strong hover:shadow-md hover:shadow-ink/6 hover:-translate-y-0.5">
      {/* Thumbnail */}
      <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-ink/5 via-paper-sunken to-ink/8">
        {course.coverImage ? (
          <img src={course.coverImage} alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-104" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-ink/12" />
          </div>
        )}

        {/* Price pill — top right */}
        <div className="absolute right-3 top-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-sm ${
            isFree
              ? "bg-teal text-white"
              : "bg-paper-raised/95 text-ink backdrop-blur-sm"
          }`}>
            {formatPrice(course.price)}
          </span>
        </div>

        {course.status === "draft" && (
          <div className="absolute left-3 top-3">
            <Badge tone="coral">Чернетка</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category */}
        {course.category && (
          <span className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gold-dark">
            {course.category.name}
          </span>
        )}

        {/* Title */}
        <h3 className="font-display text-[16px] font-semibold leading-snug text-ink line-clamp-2 group-hover:text-ink-light transition-colors">
          {course.title}
        </h3>

        {/* Author */}
        {course.teacher && (
          <p className="mt-1.5 text-xs text-slate truncate">
            {course.teacher.name} {course.teacher.surname}
          </p>
        )}

        {/* Footer stats */}
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          {lessonsCount !== null && lessonsCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-slate">
              <BookMarked className="h-3.5 w-3.5 text-slate-light" />
              {lessonsCount} {lessonsCount === 1 ? "урок" : lessonsCount < 5 ? "уроки" : "уроків"}
            </span>
          )}
          {studentsCount !== null && (
            <span className="flex items-center gap-1.5 text-xs text-slate">
              <Users className="h-3.5 w-3.5 text-slate-light" />
              {studentsCount.toLocaleString()} студентів
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
