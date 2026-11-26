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
import { Button, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/cn';

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
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  GENERATING: {
    label: 'Generating',
    description: 'Scheduling in progress',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  GENERATED: {
    label: 'Generated',
    description: 'Ready for review',
    color: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'Marked as published',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  ARCHIVED: {
    label: 'Archived',
    description: 'Kept for reference',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};
const panel = 'rounded-2xl border border-border bg-white dark:bg-slate-900 p-5 sm:p-6';

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
          label: 'Divisions / sections',
          value: data.stats.sectionCount,
          icon: Layers,
          path: '/sections',
          allowed: canManageStudents,
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted mb-1">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-2">
            {scopeName} · Timetable progress and academic resources at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isAdmin && (
            <label className="text-xs font-medium text-muted space-y-1">
              <span className="block">Institute</span>
              <select
                value={selectedInstitute}
                onChange={(event) => setSelectedInstitute(event.target.value)}
                className="h-10 max-w-64 rounded-lg border border-border bg-white dark:bg-slate-900 px-3 text-sm text-foreground"
              >
                <option value="">All institutes</option>
                {institutes.map((institute) => (
                  <option key={institute.id} value={institute.id}>
                    {institute.code} — {institute.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </Button>
          {canManage && (
            <Button onClick={() => navigate('/scheduler')} className="gap-2">
              <Plus size={16} /> Generate timetable
            </Button>
          )}
          {!canManage && (
            <Button onClick={() => navigate('/timetable')} className="gap-2">
              <CalendarDays size={16} /> View timetable
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
          <AlertTriangle className="text-amber-600 mb-3" />
          <h2 className="font-semibold">Dashboard could not be loaded</h2>
          <p className="text-sm text-muted mt-1 mb-4">
            Try again to load the latest counts and timetables.
          </p>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: 'Total timetables',
                value: total,
                description: 'All saved timetables in this scope',
                icon: CalendarDays,
                color: 'text-primary',
              },
              {
                title: 'Ready for review',
                value: count('GENERATED'),
                description: 'Generated and awaiting review',
                icon: Clock,
                color: 'text-amber-600',
              },
              {
                title: 'Published',
                value: count('PUBLISHED'),
                description: 'Timetables marked as published',
                icon: CheckCircle2,
                color: 'text-emerald-600',
              },
              {
                title: 'Open conflicts',
                value: data.stats.unresolvedConflicts,
                description: 'In generated and published timetables',
                icon: AlertTriangle,
                color: data.stats.unresolvedConflicts ? 'text-amber-600' : 'text-muted',
              },
            ].map((item) => (
              <div key={item.title} className={panel}>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm font-medium text-muted">{item.title}</p>
                  <item.icon size={19} className={item.color} />
                </div>
                <p className="text-3xl font-semibold tracking-tight mt-3 tabular-nums">
                  {item.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted mt-2">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className={`${panel} xl:col-span-2`}>
              <div className="flex justify-between items-center gap-3 mb-5">
                <div>
                  <h2 className="font-semibold text-lg">Recent timetables</h2>
                  <p className="text-xs text-muted mt-1">
                    The five most recently updated timetables.
                  </p>
                </div>
                <Link
                  to="/timetable"
                  className="text-sm font-medium text-primary whitespace-nowrap"
                >
                  View all →
                </Link>
              </div>
              {data.recentTimetables.length ? (
                <div className="divide-y divide-border">
                  {data.recentTimetables.map((timetable) => (
                    <button
                      key={timetable.id}
                      onClick={() => openTimetable(timetable.id)}
                      className="w-full py-4 first:pt-0 last:pb-0 flex items-start gap-3 text-left group focus-visible:outline-primary"
                    >
                      <div className="rounded-xl bg-primary/5 text-primary p-2.5 hidden sm:block">
                        <CalendarDays size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm group-hover:text-primary break-words">
                          {timetable.name}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          {timetable.department?.code ?? 'Multiple departments'} ·{' '}
                          {timetable.semester.name}
                        </p>
                        <p className="text-xs text-muted mt-2">
                          {timetable._count.entries} scheduled periods · Updated{' '}
                          {formatDate(timetable.updatedAt)}
                        </p>
                        {timetable._count.conflicts > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {timetable._count.conflicts} unresolved conflicts
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-md shrink-0 ${statusInfo[timetable.status]?.color ?? ''}`}
                      >
                        {statusInfo[timetable.status]?.label ?? timetable.status}
                      </span>
                      <ArrowRight size={16} className="text-muted mt-1 hidden sm:block" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CalendarDays size={30} className="mx-auto text-muted mb-3" />
                  <h3 className="font-medium">No timetables yet</h3>
                  <p className="text-sm text-muted mt-2">
                    {canManage
                      ? 'Check your academic data, then generate your first timetable.'
                      : 'Timetables will appear here after they are created.'}
                  </p>
                  {canManage && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate('/scheduler')}
                    >
                      Open scheduler
                    </Button>
                  )}
                </div>
              )}
            </section>
            <section className={panel}>
              <h2 className="font-semibold text-lg">Timetable status</h2>
              <p className="text-xs text-muted mt-1 mb-5">What each stage means.</p>
              <div className="space-y-4">
                {Object.entries(statusInfo).map(([key, info]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <span
                        className={`inline-block text-xs font-medium rounded-md px-2 py-1 ${info.color}`}
                      >
                        {info.label}
                      </span>
                      <p className="text-xs text-muted mt-1.5">{info.description}</p>
                    </div>
                    <span className="text-xl font-semibold tabular-nums">{count(key)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={panel}>
            <h2 className="text-lg font-semibold">Academic resources</h2>
            <p className="text-xs text-muted mt-1 mb-5">
              Active records in {scopeName.toLowerCase()}. Classrooms and laboratories are counted
              separately.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
              {resources.map((resource) => {
                const content = (
                  <>
                    <resource.icon size={18} className="text-muted mb-3" />
                    <p className="text-2xl font-semibold tabular-nums">
                      {resource.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted mt-1">{resource.label}</p>
                  </>
                );
                const className = 'rounded-xl border border-border p-4';
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

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="text-lg font-semibold">{canManage ? 'Next steps' : 'Quick links'}</h2>
              <p className="text-xs text-muted mt-1 mb-4">
                {canManage
                  ? 'Follow these steps to prepare a timetable.'
                  : 'Find your timetable and updates.'}
              </p>
              {(canManage
                ? [
                    {
                      title: 'Check academic data',
                      description: 'Review subjects and faculty before scheduling.',
                      path: '/subjects',
                    },
                    {
                      title: 'Generate a timetable',
                      description: 'Choose the institute, semester and divisions.',
                      path: '/scheduler',
                    },
                    {
                      title: 'Review the timetable',
                      description: 'Check unassigned sessions and resolve conflicts.',
                      path: '/timetable',
                    },
                  ]
                : [
                    {
                      title: 'View timetable',
                      description: 'Find your classes, faculty and rooms.',
                      path: '/timetable',
                    },
                    {
                      title: 'Read notifications',
                      description: 'See updates sent to your account.',
                      path: '/notifications',
                    },
                  ]
              ).map((step, index) => (
                <Link
                  key={step.title}
                  to={step.path}
                  className="flex items-center gap-3 py-3 group"
                >
                  <span className="h-8 w-8 rounded-full bg-primary/5 text-primary text-sm flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium group-hover:text-primary">{step.title}</p>
                    <p className="text-xs text-muted mt-1">{step.description}</p>
                  </div>
                  <ArrowRight size={16} className="text-muted" />
                </Link>
              ))}
              {user?.email?.toLowerCase() === 'masteradmin@charusat.edu.in' && (
                <Link
                  to="/master-admin"
                  className="flex items-center gap-2 text-sm text-primary mt-3 pt-4 border-t border-border"
                >
                  <Sliders size={15} /> Manage feature availability
                </Link>
              )}
            </section>
            <section className={panel}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex gap-2 items-center">
                  <Bell size={18} /> Your notifications
                </h2>
                <Link to="/notifications" className="text-sm text-primary">
                  View all →
                </Link>
              </div>
              <p className="text-xs text-muted mb-4">
                Your latest unread messages, across institutes.
              </p>
              {data.notifications.length ? (
                <div className="space-y-4">
                  {data.notifications.map((notification) => (
                    <Link
                      to="/notifications"
                      key={notification.id}
                      className="block border-l-2 border-primary/40 pl-3"
                    >
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted mt-1 line-clamp-2">{notification.message}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-600 mb-2" />
                  <p className="text-sm font-medium">You're all caught up</p>
                  <p className="text-xs text-muted mt-1">You have no unread notifications.</p>
                </div>
              )}
            </section>
          </div>
          <p className="text-xs text-muted text-right">
            Last refreshed{' '}
            {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </>
      )}
    </div>
  );
}
