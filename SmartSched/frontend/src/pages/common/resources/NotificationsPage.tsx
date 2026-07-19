import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api';
import { Button, Card } from '@/components/ui';
import { ResourcePage } from '../ResourcePage';

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationsApi.list({ limit: 50 })).data.data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Notifications</h2>
        <Button
          variant="outline"
          onClick={async () => {
            await notificationsApi.markAll();
            qc.invalidateQueries({ queryKey: ['notifications'] });
          }}
        >
          Mark all read
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="p-6">
            Loading…
          </div>
        ) : (
          (data ?? []).map((n) => (
            <Card key={(n as any).id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{(n as any).title}</p>
                  <p className="text-sm text-muted">{(n as any).message}</p>
                </div>
                <div className="text-sm text-muted">{(n as any).createdAt}</div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
