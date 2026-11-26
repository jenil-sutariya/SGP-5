import React from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { labsApi, roomsApi, institutesApi, departmentsApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';

export function LabsPage() {
  const { user, instituteId } = useInstituteScope();
  const { data: roomTypes = [] } = useQuery({ queryKey: ['room-types'], queryFn: async () => (await roomsApi.types()).data.data });
  const roomTypeField = { key: 'roomTypeId', label: 'Room type for subject requirements', type: 'select' as const, options: roomTypes.map((r:any)=>({value:r.id,label:r.name})) };
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

  const { data: departments } = useQuery({
    queryKey: ['departments', 'scoped', instituteId ?? 'all'],
    queryFn: async () => {
      try {
        const res = await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) });
        const raw = (res as any)?.data?.data ?? (res as any)?.data ?? [];
        const items = Array.isArray(raw) ? raw : (raw.items ?? raw.data ?? []);
        if (items.length > 0) return items as { id: string; code: string; name: string; instituteId: string }[];
        const fallbackRes = await departmentsApi.list({ limit: 100 });
        const fallbackRaw = (fallbackRes as any)?.data?.data ?? (fallbackRes as any)?.data ?? [];
        return (Array.isArray(fallbackRaw) ? fallbackRaw : (fallbackRaw.items ?? fallbackRaw.data ?? [])) as {
          id: string;
          code: string;
          name: string;
          instituteId: string;
        }[];
      } catch {
        try {
          const fallbackRes = await departmentsApi.list({ limit: 100 });
          const fallbackRaw = (fallbackRes as any)?.data?.data ?? (fallbackRes as any)?.data ?? [];
          return (Array.isArray(fallbackRaw) ? fallbackRaw : (fallbackRaw.items ?? fallbackRaw.data ?? [])) as {
            id: string;
            code: string;
            name: string;
            instituteId: string;
          }[];
        } catch {
          return [];
        }
      }
    },
    enabled: canCreate,
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const buildingOptions = (buildings ?? []).map((b) => ({
    value: b.id,
    label: b.name,
    meta: { instituteId: b.instituteId ?? '' },
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
      listFn={async (search, page, limit, departmentId) =>
        (await labsApi.list({
          search,
          page,
          limit,
          ...(departmentId ? { departmentId } : {}),
          ...(instituteId ? { instituteId } : {}),
        })).data
      }
      columns={[
        {
          key: 'timetable', label: 'Timetable',
          render: (row) => (
            <Link to={'/labs/' + encodeURIComponent(String(row.id)) + '/timetable'}
              title={'View timetable for ' + String(row.code)}
              aria-label={'View timetable for ' + String(row.code)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <Eye size={17} />
            </Link>
          ),
        },
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
              { key: 'equipment', label: 'Equipment (comma-separated)' },
              roomTypeField,
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
        roomTypeField,
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'capacity', label: 'Capacity', type: 'number' },
        { key: 'floor', label: 'Floor', type: 'number' },
        { key: 'labType', label: 'Lab Type' },
        { key: 'equipment', label: 'Equipment' },
      ]}
      updateFn={(id, data) => labsApi.update(id, { ...data, roomTypeId: data.roomTypeId || null })}
      removeFn={(id) => labsApi.remove(id)}
    />
  );
}
