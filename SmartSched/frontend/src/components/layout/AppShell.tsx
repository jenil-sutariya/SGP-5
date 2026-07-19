import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  DoorOpen,
  FlaskConical,
  CalendarDays,
  Cpu,
  Settings,
  Bell,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useThemeStore, RoleName } from '@/store/authStore';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import { ROLE_LABELS, UNIVERSITY } from '@/constants/university';

const navItems: { to: string; label: string; icon: React.ElementType; roles?: RoleName[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/institutes', label: 'Institutes', icon: Building2, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'SCHEDULER'] },
  { to: '/departments', label: 'Departments', icon: Building2, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'] },
  { to: '/batches', label: 'Batches / Classes', icon: GraduationCap, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'] },
  { to: '/sections', label: 'Sections & Batches', icon: Users, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'] },
  { to: '/faculty', label: 'Professors', icon: Users, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'] },
  { to: '/students', label: 'Students', icon: GraduationCap, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'] },
  { to: '/courses', label: 'Courses', icon: BookOpen, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'] },
  { to: '/subjects', label: 'Subjects', icon: BookOpen, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'] },
  { to: '/rooms', label: 'Classrooms', icon: DoorOpen, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'] },
  { to: '/labs', label: 'Labs', icon: FlaskConical, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'] },
  { to: '/timetable', label: 'My Timetable', icon: CalendarDays },
  { to: '/scheduler', label: 'Generate', icon: Cpu, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'SCHEDULER', 'DEPARTMENT_HEAD'] },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = user?.role?.name;

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', dark);
  }, [theme]);

  const filtered = navItems.filter((n) => !n.roles || (role && n.roles.includes(role)));

  const Sidebar = (
    <aside className="glass flex h-full w-64 flex-col rounded-none border-r p-4 lg:rounded-2xl lg:border">
      <div className="mb-8 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">{UNIVERSITY.shortName}</p>
        <h1 className="font-display text-xl font-bold tracking-tight text-primary">{UNIVERSITY.productName}</h1>
        <p className="text-xs text-muted">
          {user?.institute?.code ? `${user.institute.code} · ` : ''}
          Students & Professors
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-white shadow-sm' : 'text-foreground/70 hover:bg-primary/10 hover:text-primary'
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 border-t border-border pt-4">
        <p className="px-2 text-sm font-semibold">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="px-2 text-xs text-muted">{role ? ROLE_LABELS[role] ?? role : ''}</p>
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut size={16} /> Logout
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen lg:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4">
        <div className="hidden lg:block">{Sidebar}</div>
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            >
              <motion.div
                className="h-full w-72"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                onClick={(e) => e.stopPropagation()}
              >
                {Sidebar}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass no-print mb-4 flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
                {open ? <X size={18} /> : <Menu size={18} />}
              </Button>
              <div>
                <p className="font-display text-lg font-semibold">Welcome to {UNIVERSITY.shortName}</p>
                <p className="text-xs text-muted">{UNIVERSITY.motto}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigate('/notifications')}>
                <Bell size={16} />
              </Button>
            </div>
          </header>
          <main className="flex-1 pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
