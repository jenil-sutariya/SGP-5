import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Mail, ShieldCheck, Building2, Settings } from 'lucide-react';
import { authApi } from '@/api';
import { Card, Button, Badge } from '@/components/ui';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { ROLE_LABELS } from '@/constants/university';
import { InstituteBadge } from '@/components/common/InstituteBadge';

export default function ProfilePage() {
  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { data: user = storeUser } = useQuery({
    queryKey: ['auth-me', storeUser?.id],
    enabled: !!storeUser?.id,
    initialData: storeUser ?? undefined,
    queryFn: async () => (await authApi.me()).data.data as AuthUser,
  });

  useEffect(() => {
    if (user && user.id === storeUser?.id) setUser(user);
  }, [user, storeUser?.id, setUser]);
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const roleLabel = user?.role?.name ? ROLE_LABELS[user.role.name] ?? user.role.name : 'User';

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        {user ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center font-display font-bold text-lg shrink-0">
                  {initials}
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                    {user.firstName} {user.lastName}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="primary">{roleLabel}</Badge>
                    {user.institute?.code && <InstituteBadge code={user.institute.code} size="sm" />}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/timetable">
                    <CalendarDays size={14} aria-hidden="true" /> Timetable
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/settings">
                    <Settings size={14} aria-hidden="true" /> Settings
                  </Link>
                </Button>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-border bg-surface-subtle/50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Mail size={13} aria-hidden="true" /> Email
                </dt>
                <dd className="mt-1 font-medium text-foreground break-all">{user.email}</dd>
              </div>
              <div className="rounded-xl border border-border bg-surface-subtle/50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <ShieldCheck size={13} aria-hidden="true" /> Portal Role
                </dt>
                <dd className="mt-1 font-medium text-foreground">{roleLabel}</dd>
              </div>
              {user.institute && (
                <div className="rounded-xl border border-border bg-surface-subtle/50 p-4 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Building2 size={13} aria-hidden="true" /> Institute
                  </dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {user.institute.code} — {user.institute.name}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted">No user session found.</p>
        )}
      </Card>
    </div>
  );
}
