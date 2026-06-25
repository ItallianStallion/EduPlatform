// Типи відповідають моделям бекенду EduPlatform (див. документацію API)

export type UserRole = "student" | "teacher" | "admin";
export type CourseStatus = "draft" | "published";
export type LessonType = "video" | "text" | "pdf";
export type PriceFilter = "free" | "paid" | "any";
export type SortBy = "popular" | "newest" | "price_asc" | "price_desc";
export type AccessMode = "open" | "sequential";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: string[];
  code?: string;
}

export interface Paginated<T> {
  items: T[];
  totalCount: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  isBanned: boolean;
  balance: string | number;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Course {
  id: string;
  teacherId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  coverImage: string | null;
  price: string | number;
  status: CourseStatus;
  accessMode: AccessMode;
  createdAt: string;
  updatedAt: string;
  teacher?: Pick<User, "id" | "name" | "surname">;
  category?: Category | null;
  studentsCount?: number;
  lessonsCount?: number;
  enrollmentCount?: string | number;
  isEnrolled?: boolean;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  type: LessonType;
  content: string | null;
  videoUrl: string | null;
  pdfUrl: string | null;
  order: number;
  completed?: boolean;
}


export interface TopicTest {
  id: string;
  title: string;
  passingScore: number;
  maxAttempts: number | null;
}

export interface Topic {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  lessons: (Lesson & { locked?: boolean })[];
  test: TopicTest | null;
  createdAt?: string;
}

export interface TestQuestion {
  question: string;
  options: string[];
  correctIndex?: number; // приховано від студентів
}

export interface Test {
  id: string;
  courseId: string | null;
  lessonId?: string | null;
  title: string;
  questions: TestQuestion[];
  passingScore: number;
  maxAttempts: number | null;
  attemptsUsed?: number;
  attemptsLeft?: number | null;
  questionsCount?: number;
}

export interface TestSummary {
  id: string;
  courseId?: string | null;
  lessonId?: string | null;
  title: string;
  questionsCount: number;
  passingScore: number;
}

/** Тест блоку у складі `GET /lessons/course/:courseId/blocks`. */
export interface BlockTest {
  id: string;
  title: string;
  passingScore: number;
  maxAttempts: number | null;
  /** `true`/`false` для студента, `null` для викладача/адміна (не прив'язано до конкретного студента). */
  passed: boolean | null;
}

/** Блок "урок (+ опційний тест)" у складі `GET /lessons/course/:courseId/blocks`. */
export interface CourseBlock {
  lesson: Lesson & { locked: boolean };
  test: BlockTest | null;
}

/** Блок із детальним прогресом — частина `GET /progress/courses/:courseId` та аналітики студента. */
export interface ProgressBlock {
  lesson: Pick<Lesson, "id" | "title" | "type" | "order">;
  lessonCompleted: boolean;
  completedAt: string | null;
  test: {
    id: string;
    title: string;
    passingScore: number;
    passed: boolean;
    bestScore: number | null;
    attemptsCount: number;
  } | null;
  isCompleted: boolean;
}

export interface ProgressLessonItem {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  completed: boolean;
  completedAt?: string | null;
}

export interface TestSubmitResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  details: { question: string; yourAnswer: string; correctAnswer: string; isCorrect: boolean }[];
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  course?: Course;
}

export interface Progress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  completedAt: string | null;
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  allLessonsDone: boolean;
  allBlocksDone: boolean;
  isCompleted: boolean;
  /** Legacy курсовий тест (один на весь курс). Для нових блокових курсів — завжди `hasTest: false`. */
  test: {
    hasTest: boolean;
    passed: boolean | null;
    bestScore: number | null;
    attemptsCount: number;
  };
  blocks: ProgressBlock[];
  lessons: ProgressLessonItem[];
}

export interface MyProgressItem {
  course: Course;
  percentage: number;
  totalLessons: number;
  completedLessons: number;
}

export interface AnalyticsDashboard {
  summary: {
    totalCourses: number;
    publishedCourses: number;
    totalStudents: number;
    totalRevenue: number;
    teacherBalance: number;
  };
  courses: {
    id: string;
    title: string;
    status: CourseStatus;
    price: number;
    category: string | null;
    students: number;
    revenue: {
      gross: number;
      teacherNet: number;
    };
  }[];
}

export interface CourseAnalytics {
  course: {
    id: string;
    title: string;
    status: CourseStatus;
    price: number;
  };
  students: {
    total: number;
    lastEnrollmentAt: string | null;
    completedCourse: number;
    passedTest: number;
  };
  lessons: {
    total: number;
  };
  blocks: {
    total: number;
    withTest: number;
  };
  test: {
    hasLegacyCourseTest: boolean;
  };
  progress: {
    averagePercentage: number;
  };
  revenue: {
    gross: number;
    platformFee: number;
    teacherNet: number;
  };
}

export interface CourseStudent {
  student: Pick<User, "id" | "name" | "surname" | "email">;
  enrolledAt: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
  allLessonsDone: boolean;
  allBlocksDone: boolean;
  isCompleted: boolean;
  blocks: ProgressBlock[];
  legacyTest: {
    hasTest: boolean;
    passed: boolean | null;
    bestScore: number | null;
    attemptsCount: number;
  };
}

export interface AdminUserListItem extends User {
  profile?: UserProfile | null;
}
