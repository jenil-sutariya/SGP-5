import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { roomsApi, institutesApi, departmentsApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';

export function RoomsPage() {
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
    queryKey: ['buildings', 'scoped', instituteId ?? 'all'],
    queryFn: async () => (await roomsApi.buildings({ ...(instituteId ? { instituteId } : {}) })).data.data as { id: string; name: string; code?: string; instituteId?: string }[],
    enabled: canCreate,
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => (await roomsApi.types()).data.data as { id: string; name: string }[],
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
    meta: { instituteId: b.instituteId ?? '' },
  }));
  const roomTypeOptions = (roomTypes ?? []).map((t) => ({ value: t.id, label: t.name }));
  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  return (
    <ResourcePage
      title="Classrooms / Rooms"
      queryKey="rooms"
      listFn={async (search, page, limit, departmentId) =>
        (await roomsApi.list({
          search,
          page,
          limit,
          ...(departmentId ? { departmentId } : {}),
          ...(instituteId ? { instituteId } : {}),
        })).data
      }
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'capacity', label: 'Capacity' },
        {
          key: 'type',
          label: 'Type',
          render: (r) => (r.roomType as { name: string })?.name ?? '—',
        },
        {
          key: 'building',
          label: 'Building',
          render: (r) => (r.building as { name: string })?.name ?? '—',
        },
      ]}
      createFields={
        canCreate
          ? [
              { key: 'code', label: 'Room Code (e.g. A101)' },
              { key: 'name', label: 'Room Name' },
              ...(isAdmin ? [{
                key: 'instituteId',
                label: 'Institute',
                type: 'select' as const,
                options: instituteOptions,
              }] : []),
              {
                key: 'buildingId',
                label: 'Building',
                type: 'select',
                options: buildingOptions,
                ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
              },
              {
                key: 'roomTypeId',
                label: 'Room Type',
                type: 'select',
                options: roomTypeOptions,
              },
              {
                key: 'departmentId',
                label: 'Department (optional)',
                type: 'select' as const,
                options: departmentOptions,
                ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
              },
              { key: 'capacity', label: 'Capacity', type: 'number' as const },
              { key: 'floor', label: 'Floor', type: 'number' as const },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              if (!data.buildingId) return Promise.reject({ response: { data: { message: 'Building is required' } } });
              if (!data.roomTypeId) return Promise.reject({ response: { data: { message: 'Room type is required' } } });
              if (!data.capacity) return Promise.reject({ response: { data: { message: 'Capacity is required' } } });
              return roomsApi.create({
                ...data,
                capacity: Number(data.capacity),
                floor: data.floor ? Number(data.floor) : undefined,
                departmentId: data.departmentId || null,
              });
            }
          : undefined
      }
      editFields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'capacity', label: 'Capacity', type: 'number' },
        { key: 'floor', label: 'Floor', type: 'number' },
      ]}
      updateFn={(id, data) => roomsApi.update(id, data)}
      removeFn={(id) => roomsApi.remove(id)}
    />
  );
}
