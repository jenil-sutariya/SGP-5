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
import MasterAdminPage from '@/pages/MasterAdmin/MasterAdminPage';
import { FeatureGuard } from '@/components/common/FeatureGuard';

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
const masterAdminEmails: string[]    = ['masteradmin@charusat.edu.in'];

function Protected({ roles, allowedEmails }: { roles?: RoleName[]; allowedEmails?: string[] }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role.name)) return <Navigate to="/dashboard" replace />;
  if (allowedEmails && !allowedEmails.includes(user.email.toLowerCase())) return <Navigate to="/dashboard" replace />;
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
        <Route path="/timetable"      element={<FeatureGuard featureKey="timetable"><TimetablePage /></FeatureGuard>} />
        <Route path="/notifications"  element={<FeatureGuard featureKey="notifications"><NotificationsPage /></FeatureGuard>} />
        <Route path="/settings"       element={<SettingsPage />} />
        <Route path="/profile"        element={<ProfilePage />} />
      </Route>

      {/* Master Admin Feature Control */}
      <Route element={<Protected allowedEmails={masterAdminEmails} />}>
        <Route path="/master-admin"   element={<MasterAdminPage />} />
      </Route>

      {/* Management routes — admins, heads, scheduler */}
      <Route element={<Protected roles={manageRoles} />}>
        <Route path="/institutes"     element={<FeatureGuard featureKey="institutes"><InstitutesPage /></FeatureGuard>} />
        <Route path="/departments"    element={<FeatureGuard featureKey="departments"><DepartmentsPage /></FeatureGuard>} />
        <Route path="/faculty"        element={<FeatureGuard featureKey="faculty"><FacultyPage /></FeatureGuard>} />
        <Route path="/courses"        element={<FeatureGuard featureKey="courses"><CoursesPage /></FeatureGuard>} />
        <Route path="/subjects"       element={<FeatureGuard featureKey="subjects"><SubjectsPage /></FeatureGuard>} />
        <Route path="/rooms"          element={<FeatureGuard featureKey="rooms"><RoomsPage /></FeatureGuard>} />
        <Route path="/labs"           element={<FeatureGuard featureKey="labs"><LabsPage /></FeatureGuard>} />
        <Route path="/scheduler"      element={<FeatureGuard featureKey="scheduler"><SchedulerPage /></FeatureGuard>} />
      </Route>

      {/* Student management — admins and department heads */}
      <Route element={<Protected roles={studentManageRoles} />}>
        <Route path="/batches"        element={<FeatureGuard featureKey="batches"><BatchesPage /></FeatureGuard>} />
        <Route path="/sections"       element={<FeatureGuard featureKey="sections"><SectionsPage /></FeatureGuard>} />
        <Route path="/students"       element={<FeatureGuard featureKey="students"><StudentsPage /></FeatureGuard>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
