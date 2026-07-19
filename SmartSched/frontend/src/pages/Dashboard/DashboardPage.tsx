import { useQuery } from '@tanstack/react-query';
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
} from 'recharts';
import { Users, GraduationCap, Building2, BookOpen } from 'lucide-react';
import { analyticsApi } from '@/api';
import { Card, Badge, Skeleton } from '@/components/ui';
import { formatDate } from '@/utils/cn';
import { UNIVERSITY } from '@/constants/university';
import { useAuthStore } from '@/store/authStore';

const COLORS = ['#0B3D91', '#C45C26', '#22C55E', '#F59E0B', '#EF4444'];

function StatCard({
  title,
  value,
  icon: Icon,
  delay,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="flex items-center gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon size={22} />
        </div>
        <div>
          <p className="text-xs text-muted">{title}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
        </div>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await analyticsApi.dashboard()).data.data,
  });
  const { data: rooms } = useQuery({
    queryKey: ['room-util'],
    queryFn: async () => (await analyticsApi.roomUtilization()).data.data,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const stats = data?.stats ?? {};
  const statusData = (data?.timetableStatus ?? []).map((s: { status: string; count: number }) => ({
    name: s.status,
    value: s.count,
  }));

  const instCode = user?.institute?.code ?? UNIVERSITY.primaryInstitute;
  const instName = user?.institute?.fullName ?? user?.institute?.name ?? UNIVERSITY.fullName;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">{instCode} Dashboard</h2>
        <p className="text-sm text-muted">
          {instCode} · {instName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Professors" value={stats.facultyCount ?? 0} icon={Users} delay={0.05} />
        <StatCard title="Students" value={stats.studentCount ?? 0} icon={GraduationCap} delay={0.1} />
        <StatCard title="Departments" value={stats.departmentCount ?? 0} icon={Building2} delay={0.15} />
        <StatCard title="Courses" value={stats.courseCount ?? 0} icon={BookOpen} delay={0.2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold">Room Utilization</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(rooms ?? []).slice(0, 8)}>
                <XAxis dataKey="room" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="utilization" fill="#0B3D91" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 font-semibold">Timetable Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold">Recent Activity</h3>
          <div className="space-y-3">
            {(data?.recentActivity ?? []).map((log: { id: string; action: string; entity: string; createdAt: string; user?: { firstName: string; lastName: string } }) => (
              <div key={log.id} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm">
                <div>
                  <p className="font-medium">
                    {log.action} · {log.entity}
                  </p>
                  <p className="text-xs text-muted">
                    {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                  </p>
                </div>
                <span className="text-xs text-muted">{formatDate(log.createdAt)}</span>
              </div>
            ))}
            {!data?.recentActivity?.length && <p className="text-sm text-muted">No recent activity</p>}
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 font-semibold">Notifications</h3>
          <div className="space-y-3">
            {(data?.notifications ?? []).map((n: { id: string; title: string; message: string; type: string }) => (
              <div key={n.id} className="rounded-xl border border-border/60 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <Badge variant={n.type === 'SUCCESS' ? 'success' : n.type === 'WARNING' ? 'warning' : 'default'}>
                    {n.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted">{n.message}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
