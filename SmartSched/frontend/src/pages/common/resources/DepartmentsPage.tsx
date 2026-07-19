import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentsApi, institutesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';
import { Badge } from '@/components/ui';

export function DepartmentsPage() {
  const { user, instituteId } = useInstituteScope();
  const canCreate = user?.role?.name === 'ADMIN' || user?.role?.name === 'INSTITUTE_ADMIN' || user?.role?.name === 'DEPARTMENT_HEAD';

  const { data: institutes } = useQuery({
    queryKey: ['institutes'],
    queryFn: async () => (await institutesApi.list()).data.data as { id: string; code: string; name: string }[],
    enabled: user?.role?.name === 'ADMIN',
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));

  return (
    <ResourcePage
      title="Departments"
      queryKey="departments"
      emptyMessage="No departments found for your institute"
      listFn={async (search) =>
        (await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}), ...(search ? { search } : {}) })).data.data
      }
      columns={[
        {
          key: 'institute',
          label: 'Institute',
          render: (r) => (r.institute as { code?: string })?.code ?? '—',
        },
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description', render: (r) => String(r.description ?? '—') },
        {
          key: 'counts',
          label: 'Faculty / Students',
          render: (r) => {
            const c = r._count as { faculty?: number; students?: number };
            return `${c?.faculty ?? 0} / ${c?.students ?? 0}`;
          },
        },
        {
          key: 'isActive',
          label: 'Status',
          render: (r) => (
            <Badge variant={r.isActive ? 'success' : 'danger'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
          ),
        },
      ]}
      createFields={
        canCreate
          ? [
              ...(user?.role?.name === 'ADMIN'
                ? [{
                    key: 'instituteId',
                    label: 'Institute',
                    type: 'select' as const,
                    options: instituteOptions,
                  }]
                : []),
              { key: 'code', label: 'Dept code (e.g. CSE)' },
              { key: 'name', label: 'Department name' },
              { key: 'description', label: 'Description (optional)' },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              const resolvedInstituteId = data.instituteId || user?.instituteId;
              if (!resolvedInstituteId) {
                return Promise.reject({ response: { data: { message: 'Institute is required' } } });
              }
              return departmentsApi.create({ ...data, instituteId: resolvedInstituteId });
            }
          : undefined
      }
      editFields={
        canCreate
          ? [
              { key: 'code', label: 'Dept Code' },
              { key: 'name', label: 'Name' },
              { key: 'description', label: 'Description' },
            ]
          : undefined
      }
      updateFn={canCreate ? (id, data) => departmentsApi.update(id, data) : undefined}
      removeFn={canCreate ? (id) => departmentsApi.remove(id) : undefined}
    />
  );
}
