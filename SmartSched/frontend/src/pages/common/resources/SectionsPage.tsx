import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sectionsApi, departmentsApi, academicApi, institutesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';
import { Button } from '@/components/ui';
import { toast } from 'sonner';

export function SectionsPage() {
  const qc = useQueryClient();
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

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: async () => (await academicApi.semesters()).data.data as { id: string; name: string }[],
  });

  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => (await academicApi.programs()).data.data as { id: string; name: string; departmentId: string }[],
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));
  const semesterOptions = (semesters ?? []).map((s) => ({ value: s.id, label: s.name }));
  const programOptions = (programs ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    meta: { departmentId: p.departmentId },
  }));

  const autoCreateMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => sectionsApi.autoCreateBatches(id),
    onSuccess: (res) => {
      toast.success('Batches successfully partitioned (A, B, C, D...) based on section capacity');
      qc.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to auto-create batches');
    },
  });

  return (
    <ResourcePage
      title="Sections"
      queryKey="sections"
      listFn={async () => (await sectionsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data}
      columns={[
        { key: 'code', label: 'Section Code' },
        { key: 'name', label: 'Name' },
        {
          key: 'department',
          label: 'Department',
          render: (r) => (r.department as { code?: string })?.code ?? '—',
        },
        {
          key: 'semester',
          label: 'Semester',
          render: (r) => (r.semester as { name?: string })?.name ?? '—',
        },
        { key: 'capacity', label: 'Capacity' },
        { key: 'year', label: 'Academic Year' },
        {
          key: 'auto_create',
          label: 'Practical Batches',
          render: (r) => (
            <Button
              size="sm"
              variant="outline"
              onClick={() => autoCreateMutation.mutate({ id: r.id })}
              loading={autoCreateMutation.isPending && autoCreateMutation.variables?.id === r.id}
            >
              Auto Create Batches
            </Button>
          ),
        },
      ]}
      createFields={
        canCreate
          ? [
              { key: 'code', label: 'Section Code (e.g. 1CSE-1)' },
              { key: 'name', label: 'Section Name (e.g. CE Semester 1 - Div 1)' },
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
              {
                key: 'programId',
                label: 'Program',
                type: 'select' as const,
                options: programOptions,
                dependsOn: { field: 'departmentId', metaKey: 'departmentId' },
              },
              {
                key: 'semesterId',
                label: 'Semester',
                type: 'select' as const,
                options: semesterOptions,
              },
              { key: 'capacity', label: 'Capacity (e.g. 80)', type: 'number' as const },
              { key: 'year', label: 'Year (e.g. 2026)', type: 'number' as const },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              if (!data.departmentId) return Promise.reject({ response: { data: { message: 'Department is required' } } });
              if (!data.programId) return Promise.reject({ response: { data: { message: 'Program is required' } } });
              if (!data.semesterId) return Promise.reject({ response: { data: { message: 'Semester is required' } } });
              if (!data.code) return Promise.reject({ response: { data: { message: 'Section code is required' } } });
              if (!data.name) return Promise.reject({ response: { data: { message: 'Section name is required' } } });
              return sectionsApi.create({
                ...data,
                capacity: data.capacity ? Number(data.capacity) : 60,
                year: Number(data.year || new Date().getFullYear()),
              });
            }
          : undefined
      }
      editFields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'capacity', label: 'Capacity', type: 'number' },
        { key: 'year', label: 'Year', type: 'number' },
      ]}
      updateFn={(id, data) =>
        sectionsApi.update(id, {
          ...data,
          capacity: data.capacity ? Number(data.capacity) : undefined,
          year: data.year ? Number(data.year) : undefined,
        })
      }
      removeFn={(id) => sectionsApi.remove(id)}
    />
  );
}
