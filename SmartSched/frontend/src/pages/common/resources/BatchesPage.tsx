import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { batchesApi, departmentsApi, institutesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';

export function BatchesPage() {
  const { user, instituteId } = useInstituteScope();
  const isAdmin = user?.role?.name === 'ADMIN';
  const canCreate =
    user?.role?.name === 'ADMIN' ||
    user?.role?.name === 'INSTITUTE_ADMIN' ||
    user?.role?.name === 'DEPARTMENT_HEAD';

  const { data: institutes } = useQuery({
    queryKey: ['institutes'],
    queryFn: async () => (await institutesApi.list()).data.data as { id: string; code: string; name: string }[],
    enabled: canCreate,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'scoped', instituteId ?? 'all'],
    queryFn: async () => {
      try {
        const res = await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) });
        return res.data.data as { id: string; code: string; name: string; instituteId: string }[];
      } catch (err) {
        if ((err as any)?.response?.status === 400 && instituteId) {
          const res = await departmentsApi.list({ limit: 100 });
          return res.data.data as { id: string; code: string; name: string; instituteId: string }[];
        }
        throw err;
      }
    },
    enabled: canCreate,
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  return (
    <ResourcePage
      title="Student Batches / Classes"
      queryKey="batches"
      listFn={async () => (await batchesApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data}
      columns={[
        { key: 'code', label: 'Batch Code' },
        { key: 'name', label: 'Name' },
        {
          key: 'institute',
          label: 'Institute',
          render: (r) => (r.institute as { code?: string })?.code ?? '—',
        },
        {
          key: 'department',
          label: 'Department',
          render: (r) => (r.department as { code?: string })?.code ?? '—',
        },
        { key: 'batchYear', label: 'Year' },
        { key: 'semesterNo', label: 'Sem' },
        {
          key: 'students',
          label: 'Students',
          render: (r) => String((r._count as { students?: number })?.students ?? 0),
        },
      ]}
      createFields={
        canCreate
          ? [
              { key: 'code', label: 'Batch Code (e.g. CE2022)' },
              { key: 'name', label: 'Batch Name (e.g. CE 2022-26)' },
              ...(isAdmin ? [{
                key: 'instituteId',
                label: 'Institute',
                type: 'select' as const,
                options: instituteOptions,
              }] : []),
              {
                key: 'departmentId',
                label: 'Department',
                type: 'select' as const,
                options: departmentOptions,
                ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
              },
              { key: 'batchYear', label: 'Batch Year (e.g. 2022)', type: 'number' as const },
              { key: 'semesterNo', label: 'Current Semester', type: 'number' as const },
              { key: 'capacity', label: 'Capacity (optional)', type: 'number' as const },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              const resolvedInstituteId = data.instituteId || user?.instituteId;
              if (!resolvedInstituteId) return Promise.reject({ response: { data: { message: 'Institute is required' } } });
              if (!data.departmentId) return Promise.reject({ response: { data: { message: 'Department is required' } } });
              if (!data.batchYear) return Promise.reject({ response: { data: { message: 'Batch year is required' } } });
              return batchesApi.create({
                ...data,
                instituteId: resolvedInstituteId,
                batchYear: Number(data.batchYear),
                semesterNo: data.semesterNo ? Number(data.semesterNo) : undefined,
                capacity: data.capacity ? Number(data.capacity) : undefined,
              });
            }
          : undefined
      }
      editFields={[
        { key: 'code', label: 'Batch Code' },
        { key: 'name', label: 'Name' },
        { key: 'batchYear', label: 'Year', type: 'number' },
        { key: 'semesterNo', label: 'Semester', type: 'number' },
        { key: 'capacity', label: 'Capacity', type: 'number' },
      ]}
      updateFn={(id, data) => batchesApi.update(id, data)}
      removeFn={(id) => batchesApi.remove(id)}
    />
  );
}
