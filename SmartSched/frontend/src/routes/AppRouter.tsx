import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuthStore, RoleName } from '@/store/authStore';
import { AppShell } from '@/components/layout/AppShell';

// Auth pages
import LoginPage         from '@/pages/Login/LoginPage';
import ForgotPasswordPage from '@/pages/Auth/ForgotPasswordPage';

// Core pages
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import TimetablePage from '@/pages/Timetable/TimetablePage';
import SchedulerPage from '@/pages/Scheduler/SchedulerPage';
import SettingsPage  from '@/pages/Settings/SettingsPage';
import ProfilePage   from '@/pages/Profile/ProfilePage';

// Resource pages (CRUD for each domain)
import {
  InstitutesPage,
  BatchesPage,
  DepartmentsPage,
  FacultyPage,
  StudentsPage,
  CoursesPage,
  SubjectsPage,
  RoomsPage,
  LabsPage,
  NotificationsPage,
  SectionsPage,
} from '@/pages/common/ResourcePages';

const manageRoles: RoleName[]        = ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'];
const studentManageRoles: RoleName[] = ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'];

function Protected({ roles }: { roles?: RoleName[] }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role.name)) return <Navigate to="/dashboard" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage />} />

      {/* Authenticated routes — any logged-in user */}
      <Route element={<Protected />}>
        <Route path="/"               element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"      element={<DashboardPage />} />
        <Route path="/timetable"      element={<TimetablePage />} />
        <Route path="/notifications"  element={<NotificationsPage />} />
        <Route path="/settings"       element={<SettingsPage />} />
        <Route path="/profile"        element={<ProfilePage />} />
      </Route>

      {/* Management routes — admins, heads, scheduler */}
      <Route element={<Protected roles={manageRoles} />}>
        <Route path="/institutes"     element={<InstitutesPage />} />
        <Route path="/departments"    element={<DepartmentsPage />} />
        <Route path="/faculty"        element={<FacultyPage />} />
        <Route path="/courses"        element={<CoursesPage />} />
        <Route path="/subjects"       element={<SubjectsPage />} />
        <Route path="/rooms"          element={<RoomsPage />} />
        <Route path="/labs"           element={<LabsPage />} />
        <Route path="/scheduler"      element={<SchedulerPage />} />
      </Route>

      {/* Student management — admins and department heads */}
      <Route element={<Protected roles={studentManageRoles} />}>
        <Route path="/batches"        element={<BatchesPage />} />
        <Route path="/sections"       element={<SectionsPage />} />
        <Route path="/students"       element={<StudentsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
