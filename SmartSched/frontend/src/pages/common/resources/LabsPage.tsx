import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { labsApi, roomsApi, institutesApi, departmentsApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';

export function LabsPage() {
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

  const { data: buildings } = useQuery({
    queryKey: ['buildings'],
    queryFn: async () => (await roomsApi.buildings()).data.data as { id: string; name: string; code?: string; instituteId?: string }[],
    enabled: canCreate,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'scoped', instituteId ?? 'all'],
    queryFn: async () =>
      (await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data as { id: string; code: string; name: string; instituteId: string }[],
    enabled: canCreate,
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const buildingOptions = (buildings ?? []).map((b) => ({
    value: b.id,
    label: b.name,
    meta: { instituteId: b.buildingId ?? b.instituteId ?? '' },
  }));
  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  return (
    <ResourcePage
      title="Laboratories"
      queryKey="labs"
      listFn={async () => (await labsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'labType', label: 'Type' },
        {
          key: 'building',
          label: 'Building',
          render: (r) => (r.building as { name: string })?.name ?? '—',
        },
        {
          key: 'department',
          label: 'Department',
          render: (r) => (r.department as { code?: string })?.code ?? '—',
        },
      ]}
      createFields={
        canCreate
          ? [
              { key: 'code', label: 'Lab Code (e.g. LAB-101)' },
              { key: 'name', label: 'Lab Name' },
              ...(isAdmin ? [{
                key: 'instituteId',
                label: 'Institute',
                type: 'select' as const,
                options: instituteOptions,
              }] : []),
              {
                key: 'buildingId',
                label: 'Building',
                type: 'select' as const,
                options: buildingOptions,
                ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
              },
              {
                key: 'departmentId',
                label: 'Department',
                type: 'select' as const,
                options: departmentOptions,
                ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
              },
              { key: 'capacity', label: 'Capacity', type: 'number' as const },
              { key: 'floor', label: 'Floor', type: 'number' as const },
              { key: 'labType', label: 'Lab Type (e.g. Computer, Chemistry)' },
              { key: 'equipment', label: 'Equipment (optional)' },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              if (!data.buildingId) return Promise.reject({ response: { data: { message: 'Building is required' } } });
              if (!data.departmentId) return Promise.reject({ response: { data: { message: 'Department is required' } } });
              if (!data.capacity) return Promise.reject({ response: { data: { message: 'Capacity is required' } } });
              return labsApi.create({
                ...data,
                capacity: Number(data.capacity),
                floor: data.floor ? Number(data.floor) : undefined,
              });
            }
          : undefined
      }
      editFields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'capacity', label: 'Capacity', type: 'number' },
        { key: 'floor', label: 'Floor', type: 'number' },
        { key: 'labType', label: 'Lab Type' },
        { key: 'equipment', label: 'Equipment' },
      ]}
      updateFn={(id, data) => labsApi.update(id, data)}
      removeFn={(id) => labsApi.remove(id)}
    />
  );
}
