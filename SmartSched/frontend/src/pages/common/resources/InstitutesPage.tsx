import React from 'react';
import { institutesApi } from '@/api';
import { ResourcePage } from '../ResourcePage';

export function InstitutesPage() {
  return (
    <ResourcePage
      title="Institutes (CSPIT & DEPSTAR)"
      queryKey="institutes"
      listFn={async () => (await institutesApi.list()).data.data}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        {
          key: 'fullName',
          label: 'Full Name',
          render: (r) => String(r.fullName ?? '—'),
        },
        {
          key: 'departments',
          label: 'Departments',
          render: (r) => String((r._count as { departments?: number })?.departments ?? 0),
        },
        {
          key: 'batches',
          label: 'Batches',
          render: (r) => String((r._count as { batches?: number })?.batches ?? 0),
        },
        {
          key: 'admin',
          label: 'Admin',
          render: (r) => {
            const a = r.adminUser as { email?: string } | null;
            return a?.email ?? '—';
          },
        },
      ]}
      removeFn={(id) => institutesApi.remove(id)}
    />
  );
}
