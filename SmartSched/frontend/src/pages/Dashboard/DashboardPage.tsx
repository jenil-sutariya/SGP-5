import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  GraduationCap,
  Building2,
  BookOpen,
  DoorOpen,
  FlaskConical,
  CalendarDays,
  Cpu,
  Sparkles,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { analyticsApi } from '@/api';
import { Button, Skeleton, Badge } from '@/components/ui';
import { MetricCard } from '@/components/common/MetricCard';
import { GlassCard } from '@/components/common/GlassCard';
import { InstituteBadge } from '@/components/common/InstituteBadge';
import { formatDate } from '@/utils/cn';
import { UNIVERSITY } from '@/constants/university';
import { useAuthStore } from '@/store/authStore';

const CHART_COLORS = ['#0B3D91', '#1E5BB8', '#C45C26', '#D97706', '#38BDF8', '#10B981'];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await analyticsApi.dashboard()).data.data,
  });

  const { data: rooms } = useQuery({
    queryKey: ['room-util'],
    queryFn: async () => (await analyticsApi.roomUtilization()).data.data,
  });

  const instCode = user?.institute?.code ?? UNIVERSITY.primaryInstitute;
  const instName = user?.institute?.fullName ?? user?.institute?.name ?? UNIVERSITY.fullName;
  const stats = data?.stats ?? {};

  const statusData = (data?.timetableStatus ?? []).map((s: { status: string; count: number }) => ({
    name: s.status,
    value: s.count,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* VisionOS Hero Header Banner */}
      <GlassCard className="p-6 md:p-8 bg-gradient-to-r from-primary/15 via-primary-light/10 to-amber-500/10 border-primary/20 dark:border-cyan-accent/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <InstituteBadge code={instCode} size="md" />
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30">
                Semester 2026
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl md:text-3xl text-foreground tracking-tight">
              Welcome back, {user?.firstName} {user?.lastName} 👋
            </h1>
            <p className="text-sm text-muted">
              {instName} scheduling portal. AI algorithm ready for timetable synthesis and resource allocation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              className="rounded-xl gap-2 font-bold shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary-light hover:opacity-95"
              onClick={() => navigate('/scheduler')}
            >
              <Cpu size={16} /> Generate Timetable
            </Button>
            <Button
              variant="outline"
              className="rounded-xl gap-2 font-semibold glass"
              onClick={() => navigate('/timetable')}
            >
              <CalendarDays size={16} /> My Timetable
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Floating Metric Widgets Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Professors"
          value={stats.facultyCount ?? 0}
          icon={Users}
          change="+12%"
          changeType="positive"
          subtitle={`${instCode} active faculty`}
          accentGradient="from-primary/30 to-blue-500/20"
        />
        <MetricCard
          title="Enrolled Students"
          value={stats.studentCount ?? 0}
          icon={GraduationCap}
          change="+8%"
          changeType="positive"
          subtitle="Batches & divisions"
          accentGradient="from-cyan-accent/30 to-blue-600/20"
        />
        <MetricCard
          title="Departments"
          value={stats.departmentCount ?? 0}
          icon={Building2}
          subtitle="CSE, IT, CE & specialized"
          accentGradient="from-gold/30 to-amber-500/20"
        />
        <MetricCard
          title="Active Courses"
          value={stats.courseCount ?? 0}
          icon={BookOpen}
          change="Updated"
          changeType="neutral"
          subtitle="Syllabus course offerings"
          accentGradient="from-emerald-500/30 to-teal-500/20"
        />
      </div>

      {/* Glass Data Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Room & Lab Utilization */}
        <GlassCard
          title="Classroom & Lab Utilization"
          subtitle="Occupancy rate per room across peak academic hours"
          headerIcon={<DoorOpen size={18} />}
        >
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(rooms ?? []).slice(0, 8)}>
                <XAxis dataKey="room" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(16, 24, 40, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(10px)',
                  }}
                />
                <Bar dataKey="utilization" fill="url(#blueBarGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="blueBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E5BB8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0B3D91" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Timetable Status Overview */}
        <GlassCard
          title="Timetable Status Breakdown"
          subtitle="Generated vs Published timetable entries"
          headerIcon={<Activity size={18} />}
        >
          <div className="h-72 w-full flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={55}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {statusData.map((_: unknown, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(255,255,255,0.2)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(16, 24, 40, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-10 text-muted">
                <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No timetables generated yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl gap-2"
                  onClick={() => navigate('/scheduler')}
                >
                  <Cpu size={14} /> Open Scheduler
                </Button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Recent Activity & Quick System Feeds */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Audit Activity */}
        <GlassCard title="Recent Activity" subtitle="System changes and timetable updates" headerIcon={<Clock size={18} />}>
          <div className="space-y-3 pt-1">
            {(data?.recentActivity ?? []).slice(0, 5).map((log: { id: string; action: string; entity: string; createdAt: string; user?: { firstName: string; lastName: string } }) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/40 dark:bg-slate-900/40 border border-border/40 hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {log.action} · {log.entity}
                    </p>
                    <p className="text-xs text-muted">
                      By {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System Admin'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted font-medium">{formatDate(log.createdAt)}</span>
              </div>
            ))}
            {!data?.recentActivity?.length && (
              <p className="text-sm text-muted text-center py-6">No recent audit logs available</p>
            )}
          </div>
        </GlassCard>

        {/* System Notifications */}
        <GlassCard title="Notifications & Alerts" subtitle="Important updates and notices" headerIcon={<Sparkles size={18} />}>
          <div className="space-y-3 pt-1">
            {(data?.notifications ?? []).slice(0, 4).map((n: { id: string; title: string; message: string; type: string }) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-white/40 dark:bg-slate-900/40 border border-border/40 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">{n.title}</p>
                  <Badge variant={n.type === 'SUCCESS' ? 'success' : n.type === 'WARNING' ? 'warning' : 'default'}>
                    {n.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted">{n.message}</p>
              </div>
            ))}
            {!data?.notifications?.length && (
              <div className="text-center py-8 text-muted">
                <CheckCircle2 size={28} className="mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-sm font-medium">All systems normal. No pending notifications.</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
