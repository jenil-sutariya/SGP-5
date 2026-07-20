import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Menu,
  X,
  Search,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useThemeStore, RoleName } from '@/store/authStore';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import { ROLE_LABELS, UNIVERSITY } from '@/constants/university';
import { CharusatAnimatedBackground } from '@/components/common/CharusatAnimatedBackground';
import { InstituteBadge } from '@/components/common/InstituteBadge';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { CommandPaletteModal } from '@/components/common/CommandPaletteModal';

const navItems: { to: string; label: string; icon: React.ElementType; roles?: RoleName[]; badge?: string }[] = [
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
  { to: '/timetable', label: 'My Timetable', icon: CalendarDays, badge: 'Live' },
  { to: '/scheduler', label: 'Generate AI', icon: Cpu, roles: ['ADMIN', 'INSTITUTE_ADMIN', 'SCHEDULER', 'DEPARTMENT_HEAD'], badge: 'AI' },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const role = user?.role?.name;

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', dark);
  }, [theme]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
          ' · ' +
          now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = navItems.filter((n) => !n.roles || (role && n.roles.includes(role)));
  const instituteCode = user?.institute?.code || 'CHARUSAT';

  const Sidebar = (
    <aside className="glass flex h-full w-64 flex-col rounded-3xl p-5 border border-white/20 dark:border-white/10 shadow-2xl relative z-10 overflow-hidden">
      {/* Brand Header */}
      <div className="mb-6 px-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-xl bg-primary text-white shadow-md shadow-primary/30">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-primary dark:text-cyan-accent">
              SmartSched
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">CHARUSAT Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {filtered.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all group',
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-foreground/70 hover:bg-primary/10 hover:text-primary dark:hover:text-cyan-accent'
                )
              }
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary-light shadow-lg shadow-primary/30"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-3">
                <item.icon size={18} className={cn('transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-primary/70 dark:text-cyan-accent/70')} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={cn('relative z-10 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', isActive ? 'bg-white/20 text-white' : 'bg-gold/15 text-gold')}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted truncate">{role ? ROLE_LABELS[role] ?? role : ''}</p>
          </div>
          <InstituteBadge code={instituteCode} size="sm" />
        </div>
        <Button
          variant="outline"
          className="mt-2 w-full justify-start gap-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/20 font-semibold text-xs"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut size={15} /> Sign Out
        </Button>
      </div>
    </aside>
  );

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  return (
    <div className="min-h-screen relative lg:p-4 text-foreground">
      {/* Fullscreen Animated Floating Background */}
      <CharusatAnimatedBackground />

      {/* Interactive Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Main Content Layout */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-5">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block h-[calc(100vh-2rem)] sticky top-4">{Sidebar}</div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            >
              <motion.div
                className="h-full w-72 p-3"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
              >
                {Sidebar}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header Bar */}
          <header className="glass no-print mb-5 flex items-center justify-between rounded-2xl px-5 py-3.5 border border-white/20 dark:border-white/10 shadow-lg">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden rounded-xl" onClick={() => setOpen(true)}>
                {open ? <X size={20} /> : <Menu size={20} />}
              </Button>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-extrabold text-base tracking-tight text-foreground">
                    {UNIVERSITY.shortName} Portal
                  </h2>
                  <InstituteBadge code={instituteCode} size="sm" />
                </div>
                <p className="text-xs text-muted font-medium">{UNIVERSITY.motto}</p>
              </div>
            </div>

            {/* Middle Quick Search Input Placeholder */}
            <div
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 border border-border/40 text-muted text-xs font-medium w-64 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-800/80 transition-colors"
            >
              <Search size={14} className="text-muted" />
              <span>Search timetables, faculty...</span>
              <span className="ml-auto text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded text-foreground font-mono shadow-xs font-bold">
                ⌘K
              </span>
            </div>

            {/* Right Quick Controls */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:block text-right pr-2 border-r border-border/40">
                <p className="text-xs font-bold text-foreground font-mono">{currentTime}</p>
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">● Live Semester 2026</p>
              </div>

              <ThemeSwitcher />

              <Button
                variant="outline"
                size="icon"
                className="rounded-xl relative"
                onClick={() => navigate('/notifications')}
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary animate-ping" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary" />
              </Button>

              <div
                className="flex items-center gap-2 pl-2 cursor-pointer"
                onClick={() => navigate('/settings')}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-cyan-accent text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {user?.firstName?.[0] || 'U'}
                </div>
              </div>
            </div>
          </header>

          {/* Page Body Viewport */}
          <main className="flex-1 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
