import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  Users,
  GraduationCap,
  DoorOpen,
  FlaskConical,
  BookOpen,
  Layers,
  Plus,
  Sliders,
} from 'lucide-react';
import { analyticsApi, institutesApi } from '@/api';
import { Button, Select, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/cn';
import { ROLE_LABELS } from '@/constants/university';

type DashboardData = {
  stats: {
    facultyCount: number;
    studentCount: number;
    departmentCount: number;
    courseCount: number;
    roomCount: number;
    labCount: number;
    sectionCount: number;
    unresolvedConflicts: number;
  };
  timetableStatus: { status: string; count: number }[];
  recentTimetables: {
    id: string;
    name: string;
    status: string;
    updatedAt: string;
    semester: { name: string };
    department: { code: string } | null;
    _count: { entries: number; conflicts: number };
  }[];
  notifications: { id: string; title: string; message: string }[];
};

const statusInfo: Record<string, { label: string; description: string; color: string }> = {
  DRAFT: {
    label: 'Draft',
    description: 'Saved, not yet generated',
    color: 'bg-surface-subtle text-muted border border-border',
  },
  GENERATING: {
    label: 'Generating',
    description: 'Scheduling in progress',
    color: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border border-blue-500/20',
  },
  GENERATED: {
    label: 'Generated',
    description: 'Ready for review',
    color: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/25',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'Live for students & faculty',
    color: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25',
  },
  ARCHIVED: {
    label: 'Archived',
    description: 'Kept for reference',
    color: 'bg-surface-subtle text-muted border border-border',
  },
};

const panel = 'surface-card rounded-2xl p-5 sm:p-6';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const isAdmin = user?.role.name === 'ADMIN';
  const canManage = ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'].includes(
    user?.role.name ?? ''
  );
  const canManageStudents = ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'].includes(
    user?.role.name ?? ''
  );
  const instituteId = isAdmin ? selectedInstitute || undefined : user?.instituteId || undefined;

  const { data: institutes = [] } = useQuery({
    queryKey: ['dashboard-institutes', user?.id],
    enabled: isAdmin,
    queryFn: async () =>
      (await institutesApi.list()).data.data as { id: string; code: string; name: string }[],
  });

  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard', user?.id, instituteId ?? 'all'],
    queryFn: async () => (await analyticsApi.dashboard({ instituteId })).data.data as DashboardData,
  });

  const scopeName = isAdmin
    ? (institutes.find((institute) => institute.id === instituteId)?.name ?? 'All institutes')
    : (user?.institute?.name ?? 'Your institute');

  const count = (status: string) =>
    data?.timetableStatus.find((item) => item.status === status)?.count ?? 0;
  const total = data?.timetableStatus.reduce((sum, item) => sum + item.count, 0) ?? 0;

  const openTimetable = (id: string) => {
    sessionStorage.setItem('selected-timetable-id', id);
    navigate('/timetable');
  };

  const resources = data
    ? [
        {
          label: 'Faculty',
          value: data.stats.facultyCount,
          icon: Users,
          path: '/faculty',
          allowed: canManage,
        },
        {
          label: 'Students',
          value: data.stats.studentCount,
          icon: GraduationCap,
          path: '/students',
          allowed: canManageStudents,
        },
        {
          label: 'Departments',
          value: data.stats.departmentCount,
          icon: Building2,
          path: '/departments',
          allowed: canManage,
        },
        {
          label: 'Courses',
          value: data.stats.courseCount,
          icon: BookOpen,
          path: '/courses',
          allowed: canManage,
        },
        {
          label: 'Classrooms',
          value: data.stats.roomCount,
          icon: DoorOpen,
          path: '/rooms',
          allowed: canManage,
        },
        {
          label: 'Laboratories',
          value: data.stats.labCount,
          icon: FlaskConical,
          path: '/labs',
          allowed: canManage,
        },
        {
          label: 'Divisions',
          value: data.stats.sectionCount,
          icon: Layers,
          path: '/sections',
          allowed: canManageStudents,
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Overview Header */}
      <header className="surface-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-cyan-accent mb-1">
            {user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'Portal'} Workspace
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="text-sm text-muted mt-1">
            {scopeName} · Timetable progress, schedules, and campus readiness at a glance.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          {isAdmin && (
            <label className="text-xs font-semibold text-muted space-y-1">
              <span className="block">Institute scope</span>
              <Select
                value={selectedInstitute}
                onChange={(event) => setSelectedInstitute(event.target.value)}
                className="w-56"
              >
                <option value="">All institutes</option>
                {institutes.map((institute) => (
                  <option key={institute.id} value={institute.id}>
                    {institute.code} — {institute.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => navigate('/scheduler')} className="gap-2">
              <Plus size={16} aria-hidden="true" /> Generate timetable
            </Button>
          ) : (
            <Button onClick={() => navigate('/timetable')} className="gap-2">
              <CalendarDays size={16} aria-hidden="true" /> View my timetable
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-5" aria-label="Loading dashboard">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((key) => (
              <Skeleton key={key} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <div role="alert" className={panel}>
          <AlertTriangle className="text-amber-600 mb-3" aria-hidden="true" />
          <h2 className="font-display font-semibold text-lg">Dashboard could not be loaded</h2>
          <p className="text-sm text-muted mt-1 mb-4">
            Try again to load the latest counts and timetables.
          </p>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: 'Total timetables',
                value: total,
                description: 'All saved timetables in this scope',
                icon: CalendarDays,
                iconBg: 'bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent',
              },
              {
                title: 'Ready for review',
                value: count('GENERATED'),
                description: 'Generated and awaiting approval',
                icon: Clock,
                iconBg: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
              },
              {
                title: 'Published',
                value: count('PUBLISHED'),
                description: 'Live for students & professors',
                icon: CheckCircle2,
                iconBg: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
              },
              {
                title: 'Open conflicts',
                value: data.stats.unresolvedConflicts,
                description: 'In generated and published schedules',
                icon: AlertTriangle,
                iconBg: data.stats.unresolvedConflicts
                  ? 'bg-red-500/12 text-red-700 dark:text-red-300'
                  : 'bg-surface-subtle text-muted',
              },
            ].map((item) => (
              <div key={item.title} className={`${panel} glow-card`}>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {item.title}
                  </p>
                  <div className={`p-2 rounded-xl ${item.iconBg}`}>
                    <item.icon size={18} aria-hidden="true" />
                  </div>
                </div>
                <p className="font-display text-3xl font-bold tracking-tight mt-3 tabular-nums text-foreground">
                  {item.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted mt-1.5">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Recent Timetables + Status Breakdown */}
          <div className="grid gap-6 xl:grid-cols-3">
            <section className={`${panel} xl:col-span-2`}>
              <div className="flex justify-between items-center gap-3 mb-5 pb-3 border-b border-border">
                <div>
                  <h2 className="font-display font-bold text-lg">Recent timetables</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Select any timetable to inspect or export its weekly schedule.
                  </p>
                </div>
                <Link
                  to="/timetable"
                  className="text-xs font-semibold text-primary dark:text-cyan-accent hover:underline whitespace-nowrap"
                >
                  View all →
                </Link>
              </div>

              {data.recentTimetables.length ? (
                <div className="divide-y divide-border">
                  {data.recentTimetables.map((timetable) => (
                    <button
                      type="button"
                      key={timetable.id}
                      onClick={() => openTimetable(timetable.id)}
                      className="w-full py-3.5 first:pt-0 last:pb-0 flex items-start gap-3 text-left group cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="rounded-xl bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent p-2.5 hidden sm:block shrink-0">
                        <CalendarDays size={18} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground group-hover:text-primary dark:group-hover:text-cyan-accent transition-colors break-words">
                          {timetable.name}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {timetable.department?.code ?? 'Multiple departments'} ·{' '}
                          {timetable.semester.name}
                        </p>
                        <p className="text-xs text-muted mt-1.5 tabular-nums">
                          {timetable._count.entries} scheduled periods · Updated{' '}
                          {formatDate(timetable.updatedAt)}
                        </p>
                        {timetable._count.conflicts > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-1">
                            {timetable._count.conflicts} unresolved conflicts
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${statusInfo[timetable.status]?.color ?? ''}`}
                      >
                        {statusInfo[timetable.status]?.label ?? timetable.status}
                      </span>
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        className="text-muted mt-1.5 hidden sm:block group-hover:translate-x-0.5 transition-transform"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CalendarDays size={30} className="mx-auto text-muted mb-3" aria-hidden="true" />
                  <h3 className="font-semibold text-foreground">No timetables yet</h3>
                  <p className="text-sm text-muted mt-1.5">
                    {canManage
                      ? 'Verify your academic setup, then generate your first timetable.'
                      : 'Published timetables will appear here once released.'}
                  </p>
                  {canManage && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate('/scheduler')}
                    >
                      Open AI Scheduler
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section className={panel}>
              <div className="pb-3 mb-4 border-b border-border">
                <h2 className="font-display font-bold text-lg">Timetable stages</h2>
                <p className="text-xs text-muted mt-0.5">Distribution across lifecycle statuses.</p>
              </div>
              <div className="space-y-3.5">
                {Object.entries(statusInfo).map(([key, info]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <span
                        className={`inline-block text-xs font-semibold rounded-lg px-2.5 py-0.5 ${info.color}`}
                      >
                        {info.label}
                      </span>
                      <p className="text-xs text-muted mt-1">{info.description}</p>
                    </div>
                    <span className="font-display text-xl font-bold tabular-nums text-foreground">
                      {count(key)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Academic Resources */}
          {canManage && (
            <section className={panel}>
              <div className="pb-3 mb-4 border-b border-border">
                <h2 className="font-display text-lg font-bold">Academic resources</h2>
                <p className="text-xs text-muted mt-0.5">
                  Active records in {scopeName}. Classrooms and laboratories are tracked separately.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {resources.map((resource) => {
                  const content = (
                    <>
                      <resource.icon size={18} className="text-primary dark:text-cyan-accent mb-2.5" aria-hidden="true" />
                      <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                        {resource.value.toLocaleString()}
                      </p>
                      <p className="text-xs font-medium text-muted mt-1">{resource.label}</p>
                    </>
                  );
                  const className = 'rounded-xl border border-border bg-surface-subtle/50 p-4 block';
                  return resource.allowed ? (
                    <Link
                      key={resource.label}
                      to={resource.path}
                      className={`${className} hover:border-primary/40 hover:bg-primary/5 transition-colors`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={resource.label} className={className}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quick Actions & Notifications */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={panel}>
              <div className="pb-3 mb-4 border-b border-border">
                <h2 className="font-display text-lg font-bold">
                  {canManage ? 'Recommended workflow' : 'Quick links'}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {canManage
                    ? 'Follow these steps to prepare and publish a conflict-free timetable.'
                    : 'Direct shortcuts to your classes and announcements.'}
                </p>
              </div>

              <div className="space-y-2">
                {(canManage
                  ? [
                      {
                        title: 'Verify subjects & faculty',
                        description: 'Review subject hours and professor assignments before scheduling.',
                        path: '/subjects',
                      },
                      {
                        title: 'Run AI Timetable Scheduler',
                        description: 'Select institute, semester, and division scope to generate.',
                        path: '/scheduler',
                      },
                      {
                        title: 'Review & publish timetable',
                        description: 'Inspect unscheduled sessions, resolve conflicts, and publish.',
                        path: '/timetable',
                      },
                    ]
                  : [
                      {
                        title: 'View my timetable',
                        description: 'Inspect weekly periods, classrooms, labs, and faculty.',
                        path: '/timetable',
                      },
                      {
                        title: 'Check notifications',
                        description: 'See schedule changes, cancellations, and announcements.',
                        path: '/notifications',
                      },
                      {
                        title: 'My profile & campus info',
                        description: 'Review your account details and institute assignment.',
                        path: '/profile',
                      },
                    ]
                ).map((step, index) => (
                  <Link
                    key={step.title}
                    to={step.path}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-subtle transition-colors group"
                  >
                    <span className="h-8 w-8 rounded-full bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary dark:group-hover:text-cyan-accent transition-colors">
                        {step.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{step.description}</p>
                    </div>
                    <ArrowRight size={15} className="text-muted shrink-0" aria-hidden="true" />
                  </Link>
                ))}
              </div>

              {user?.email?.toLowerCase() === 'masteradmin@charusat.edu.in' && (
                <Link
                  to="/master-admin"
                  className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-cyan-accent mt-4 pt-3.5 border-t border-border hover:underline"
                >
                  <Sliders size={14} aria-hidden="true" /> Open Feature Manager
                </Link>
              )}
            </section>

            <section className={panel}>
              <div className="flex justify-between items-center pb-3 mb-4 border-b border-border">
                <div>
                  <h2 className="font-display text-lg font-bold flex gap-2 items-center">
                    <Bell size={18} className="text-primary dark:text-cyan-accent" aria-hidden="true" />
                    Unread notifications
                  </h2>
                  <p className="text-xs text-muted mt-0.5">Latest updates for your account.</p>
                </div>
                <Link
                  to="/notifications"
                  className="text-xs font-semibold text-primary dark:text-cyan-accent hover:underline"
                >
                  View all →
                </Link>
              </div>

              {data.notifications.length ? (
                <div className="space-y-3">
                  {data.notifications.map((notification) => (
                    <Link
                      to="/notifications"
                      key={notification.id}
                      className="block rounded-xl border border-border bg-surface-subtle/50 p-3 hover:border-primary/35 transition-colors"
                    >
                      <p className="font-semibold text-sm text-foreground">{notification.title}</p>
                      <p className="text-xs text-muted mt-1 line-clamp-2">{notification.message}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <CheckCircle2 size={28} className="mx-auto text-emerald-600 mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">You're all caught up</p>
                  <p className="text-xs text-muted mt-1">You have no unread notifications.</p>
                </div>
              )}
            </section>
          </div>

          <p className="text-xs text-muted text-right tabular-nums">
            Last refreshed{' '}
            {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </>
      )}
    </div>
  );
}
