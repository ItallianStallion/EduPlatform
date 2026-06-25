import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { PublicLayout } from "./layouts/PublicLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { RequireAuth, RequireRole, RedirectIfAuthenticated } from "./routes/guards";

import { LandingPage } from "./pages/public/LandingPage";
import { CourseCatalogPage } from "./pages/public/CourseCatalogPage";
import { CourseDetailsPage } from "./pages/public/CourseDetailsPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";

import { DashboardPage } from "./pages/student/DashboardPage";
import { MyCoursesPage } from "./pages/student/MyCoursesPage";
import { LessonViewerPage } from "./pages/student/LessonViewerPage";
import { TestPage } from "./pages/student/TestPage";
import { ProfilePage } from "./pages/student/ProfilePage";
import { PublicProfilePage } from "./pages/student/PublicProfilePage";

import { TeacherCoursesPage } from "./pages/teacher/TeacherCoursesPage";
import { CourseEditPage } from "./pages/teacher/CourseEditPage";
import { AnalyticsDashboardPage } from "./pages/teacher/AnalyticsDashboardPage";
import { CourseAnalyticsPage } from "./pages/teacher/CourseAnalyticsPage";

import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminCoursesPage } from "./pages/admin/AdminCoursesPage";

import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Публічний шар: каталог, деталі курсу, профілі, авторизація */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/catalog" element={<CourseCatalogPage />} />
              <Route path="/courses/:id" element={<CourseDetailsPage />} />
              <Route path="/teachers/:id" element={<PublicProfilePage />} />
              <Route
                path="/login"
                element={
                  <RedirectIfAuthenticated>
                    <LoginPage />
                  </RedirectIfAuthenticated>
                }
              />
              <Route
                path="/register"
                element={
                  <RedirectIfAuthenticated>
                    <RegisterPage />
                  </RedirectIfAuthenticated>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/lessons/:id"
                element={
                  <RequireAuth>
                    <LessonViewerPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/courses/:courseId/test"
                element={
                  <RequireAuth>
                    <TestPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/lessons/:lessonId/test"
                element={
                  <RequireAuth>
                    <TestPage />
                  </RequireAuth>
                }
              />
            </Route>

            {/* Кабінет студента */}
            <Route element={<DashboardLayout />}>
              <Route
                path="/dashboard"
                element={
                  <RequireRole role="student">
                    <DashboardPage />
                  </RequireRole>
                }
              />
              <Route
                path="/my-courses"
                element={
                  <RequireRole role={["student", "teacher"]}>
                    <MyCoursesPage />
                  </RequireRole>
                }
              />

              {/* Кабінет викладача */}
              <Route
                path="/teacher"
                element={
                  <RequireRole role="teacher">
                    <TeacherCoursesPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/courses/:id"
                element={
                  <RequireRole role={["teacher", "admin"]}>
                    <CourseEditPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/analytics"
                element={
                  <RequireRole role="teacher">
                    <AnalyticsDashboardPage />
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/courses/:id/analytics"
                element={
                  <RequireRole role="teacher">
                    <CourseAnalyticsPage />
                  </RequireRole>
                }
              />

              {/* Адмінпанель */}
              <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
              <Route
                path="/admin/users"
                element={
                  <RequireRole role="admin">
                    <AdminUsersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/courses"
                element={
                  <RequireRole role="admin">
                    <AdminCoursesPage />
                  </RequireRole>
                }
              />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
