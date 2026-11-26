import { useState, useEffect, useMemo } from 'react';
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
  Sliders,
  UserCircle2,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useThemeStore, RoleName } from '@/store/authStore';
import { useFeatureFlagsStore, useFeatureFlagsQuery, FeatureKey } from '@/store/featureFlagsStore';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import { ROLE_LABELS, UNIVERSITY } from '@/constants/university';
import { CharusatAnimatedBackground } from '@/components/common/CharusatAnimatedBackground';
import { InstituteBadge } from '@/components/common/InstituteBadge';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { CommandPaletteModal } from '@/components/common/CommandPaletteModal';

type NavSection = 'workspace' | 'scheduling' | 'academics' | 'facilities' | 'system';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  section: NavSection;
  roles?: RoleName[];
  emails?: string[];
  badge?: string;
  featureKey?: FeatureKey;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'workspace' },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, section: 'workspace', featureKey: 'timetable' },
  { to: '/notifications', label: 'Notifications', icon: Bell, section: 'workspace', featureKey: 'notifications' },

  {
    to: '/scheduler',
    label: 'AI Scheduler',
    icon: Cpu,
    section: 'scheduling',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'SCHEDULER', 'DEPARTMENT_HEAD'],
    badge: 'Auto',
    featureKey: 'scheduler',
  },

  {
    to: '/institutes',
    label: 'Institutes',
    icon: Building2,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'SCHEDULER'],
    featureKey: 'institutes',
  },
  {
    to: '/departments',
    label: 'Departments',
    icon: Building2,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'],
    featureKey: 'departments',
  },
  {
    to: '/courses',
    label: 'Courses',
    icon: BookOpen,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'],
    featureKey: 'courses',
  },
  {
    to: '/subjects',
    label: 'Subjects',
    icon: BookOpen,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'],
    featureKey: 'subjects',
  },
  {
    to: '/batches',
    label: 'Batches',
    icon: GraduationCap,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'],
    featureKey: 'batches',
  },
  {
    to: '/sections',
    label: 'Divisions & Batches',
    icon: Layers,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'],
    featureKey: 'sections',
  },
  {
    to: '/faculty',
    label: 'Professors',
    icon: Users,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'],
    featureKey: 'faculty',
  },
  {
    to: '/students',
    label: 'Students',
    icon: GraduationCap,
    section: 'academics',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'],
    featureKey: 'students',
  },

  {
    to: '/rooms',
    label: 'Classrooms',
    icon: DoorOpen,
    section: 'facilities',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'],
    featureKey: 'rooms',
  },
  {
    to: '/labs',
    label: 'Laboratories',
    icon: FlaskConical,
    section: 'facilities',
    roles: ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'],
    featureKey: 'labs',
  },

  {
    to: '/master-admin',
    label: 'Feature Manager',
    icon: Sliders,
    section: 'system',
    emails: ['masteradmin@charusat.edu.in'],
    badge: 'Master',
  },
  { to: '/profile', label: 'My Profile', icon: UserCircle2, section: 'system' },
  { to: '/settings', label: 'Settings', icon: Settings, section: 'system' },
];

const SECTION_LABELS: Record<NavSection, string> = {
  workspace: 'Workspace',
  scheduling: 'Scheduling Engine',
  academics: 'Academic Data',
  facilities: 'Rooms & Labs',
  system: 'Account & System',
};

const SECTION_ORDER: NavSection[] = ['workspace', 'scheduling', 'academics', 'facilities', 'system'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const { flags } = useFeatureFlagsStore();
  useFeatureFlagsQuery(!!user);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const filtered = useMemo(() => {
    return APP_NAV_ITEMS.filter((n) => {
      if (n.emails && (!user?.email || !n.emails.includes(user.email.toLowerCase()))) return false;
      if (n.roles && (!role || !n.roles.includes(role))) return false;
      if (n.featureKey && flags[n.featureKey] === false) return false;
      return true;
    });
  }, [user?.email, role, flags]);

  const groupedSections = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      section,
      label: SECTION_LABELS[section],
      items: filtered.filter((item) => item.section === section),
    })).filter((group) => group.items.length > 0);
  }, [filtered]);

  const currentNavItem = useMemo(() => {
    return (
      filtered.find((item) => location.pathname === item.to) ??
      filtered.find((item) => location.pathname.startsWith(item.to + '/')) ??
      (location.pathname.includes('/rooms/')
        ? { label: 'Classroom Timetable' }
        : location.pathname.includes('/labs/')
          ? { label: 'Laboratory Timetable' }
          : { label: UNIVERSITY.productName })
    );
  }, [filtered, location.pathname]);

  const instituteCode = user?.institute?.code || 'CHARUSAT';
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  const SidebarContent = (
    <aside
      aria-label="Primary navigation"
      className="surface-card flex h-full w-64 flex-col rounded-2xl p-4 relative z-10 overflow-hidden"
    >
      {/* Brand Header */}
      <div className="mb-5 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-extrabold tracking-tight text-foreground truncate">
              SmartSched
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">
              {UNIVERSITY.shortName} Portal
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-muted hover:bg-surface-subtle hover:text-foreground cursor-pointer"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Grouped Navigation Links */}
      <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
        {groupedSections.map((group) => (
          <div key={group.section} className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isActive
                        ? 'bg-primary text-white shadow-xs font-semibold'
                        : 'text-foreground/80 hover:bg-surface-subtle hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon
                        size={17}
                        aria-hidden="true"
                        className={cn(
                          'shrink-0',
                          isActive ? 'text-white' : 'text-muted'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-500/12 text-amber-800 dark:text-amber-300'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer Profile */}
      <div className="mt-4 pt-3.5 border-t border-border">
        <div className="flex items-center justify-between gap-2 px-1 mb-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted truncate">{role ? ROLE_LABELS[role] ?? role : ''}</p>
          </div>
          <InstituteBadge code={instituteCode} size="sm" />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 rounded-xl text-danger hover:bg-red-500/10 hover:border-red-500/30 border-border font-semibold text-xs"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut size={14} aria-hidden="true" /> Sign Out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen relative p-2 sm:p-3 lg:p-4 text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <CharusatAnimatedBackground />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Main Content Layout */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-1rem)] lg:min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:gap-5">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block h-[calc(100vh-2rem)] sticky top-4 shrink-0">
          {SidebarContent}
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            >
              <motion.div
                className="h-full w-72 p-3"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                {SidebarContent}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header Bar */}
          <header className="glass-chrome no-print sticky top-2 lg:top-4 z-30 mb-4 lg:mb-5 flex items-center justify-between gap-3 rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden h-9 w-9 rounded-xl shrink-0"
                onClick={() => setOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu size={18} aria-hidden="true" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-sm sm:text-base tracking-tight text-foreground truncate">
                    {currentNavItem.label}
                  </h2>
                  <InstituteBadge code={instituteCode} size="sm" className="hidden sm:inline-flex" />
                </div>
                <p className="hidden sm:block text-[11px] text-muted truncate">
                  {UNIVERSITY.fullName}
                </p>
              </div>
            </div>

            {/* Quick Navigation Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Quick navigate to any page"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 h-9 rounded-xl bg-surface-subtle border border-border text-muted text-xs font-medium w-60 lg:w-64 cursor-pointer hover:text-foreground hover:border-primary/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Search size={14} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Quick jump to page…</span>
              <kbd className="ml-auto text-[10px] bg-card border border-border px-1.5 py-0.5 rounded text-foreground font-mono font-semibold">
                Ctrl K
              </kbd>
            </button>

            {/* Right Controls */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="hidden xl:block text-right pr-2.5 border-r border-border">
                <p className="text-xs font-semibold text-foreground font-mono tabular-nums">
                  {currentTime}
                </p>
                <p className="text-[11px] font-medium text-muted">
                  {role ? ROLE_LABELS[role] ?? role : 'Portal'}
                </p>
              </div>

              <ThemeSwitcher />

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => navigate('/notifications')}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={17} aria-hidden="true" />
              </Button>

              <button
                type="button"
                onClick={() => navigate('/profile')}
                aria-label="Open my profile"
                title={`${user?.firstName ?? ''} ${user?.lastName ?? ''} — Profile`}
                className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-display font-bold text-xs shadow-xs hover:bg-primary-light transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {initials}
              </button>
            </div>
          </header>

          {/* Page Body Viewport */}
          <main id="main-content" className="flex-1 min-w-0 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
