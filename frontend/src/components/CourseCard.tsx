import { Link } from "react-router-dom";
import { Users, BookOpen } from "lucide-react";
import type { Course } from "../types";
import { formatPrice } from "../utils/helpers";
import { Badge } from "./ui";

export function CourseCard({ course }: { course: Course }) {
  const isFree = !course.price || Number(course.price) === 0;
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-paper-raised transition-shadow hover:shadow-md hover:shadow-ink/5"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-ink/5">
        {course.coverImage ? (
          <img
            src={course.coverImage}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-ink/20" />
          </div>
        )}
        {course.status === "draft" && (
          <span className="absolute left-2 top-2">
            <Badge tone="coral">Чернетка</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {course.category && <Badge>{course.category.name}</Badge>}
        <h3 className="font-display text-lg leading-snug text-ink line-clamp-2">{course.title}</h3>
        {course.teacher && (
          <p className="text-sm text-slate">
            {course.teacher.name} {course.teacher.surname}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className={`font-mono text-sm font-medium ${isFree ? "text-teal-dark" : "text-ink"}`}>
            {formatPrice(course.price)}
          </span>
          {typeof course.studentsCount === "number" && (
            <span className="flex items-center gap-1 text-xs text-slate">
              <Users className="h-3.5 w-3.5" />
              {course.studentsCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
