import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { notificationsApi } from '@/api';
import { Button, Card, Skeleton } from '@/components/ui';
import { formatDate } from '@/utils/cn';

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationsApi.list({ limit: 50 })).data.data,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Unable to mark notifications as read'),
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <section className="surface-card rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent flex items-center justify-center shrink-0">
            <Bell size={19} aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="text-sm text-muted">
              Timetable updates, cancellations, and portal alerts.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
        >
          <CheckCheck size={15} aria-hidden="true" />{' '}
          {markAllMutation.isPending ? 'Marking…' : 'Mark all read'}
        </Button>
      </section>

      <div className="space-y-2.5">
        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <Card className="py-12 text-center">
            <CheckCircle2 size={30} className="mx-auto text-emerald-600 mb-2" aria-hidden="true" />
            <p className="font-semibold text-foreground">No notifications yet</p>
            <p className="text-sm text-muted mt-1">
              You are all caught up on timetable announcements.
            </p>
          </Card>
        ) : (
          (data ?? []).map((n: any) => (
            <Card key={n.id} className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{n.title}</p>
                  <p className="text-sm text-muted mt-0.5">{n.message}</p>
                </div>
                <div className="text-xs font-mono text-muted shrink-0 tabular-nums">
                  {n.createdAt ? formatDate(n.createdAt) : ''}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
