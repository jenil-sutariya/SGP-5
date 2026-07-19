import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { subjectsApi, departmentsApi, institutesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';

export function SubjectsPage() {
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
    queryFn: async () =>
      (await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data as { id: string; code: string; name: string; instituteId: string }[],
    enabled: canCreate,
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  const typeOptions = [
    { value: 'THEORY', label: 'Theory' },
    { value: 'LAB', label: 'Lab' },
    { value: 'PRACTICAL', label: 'Practical' },
    { value: 'TUTORIAL', label: 'Tutorial' },
    { value: 'PROJECT', label: 'Project' },
  ];
  const difficultyOptions = [
    { value: 'EASY', label: 'Easy' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HARD', label: 'Hard' },
  ];

  return (
    <ResourcePage
      title="Subjects"
      queryKey="subjects"
      listFn={async () => (await subjectsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        {
          key: 'department',
          label: 'Department',
          render: (r) => (r.department as { code?: string })?.code ?? '—',
        },
        { key: 'type', label: 'Type' },
        { key: 'weeklyHours', label: 'Hours/Week' },
        { key: 'difficulty', label: 'Difficulty' },
      ]}
      createFields={
        canCreate
          ? [
              { key: 'code', label: 'Subject Code (e.g. CS301)' },
              { key: 'name', label: 'Subject Name' },
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
                key: 'type',
                label: 'Type',
                type: 'select',
                options: typeOptions,
              },
              { key: 'credits', label: 'Credits', type: 'number' },
              { key: 'weeklyHours', label: 'Hours/Week', type: 'number' },
              {
                key: 'difficulty',
                label: 'Difficulty',
                type: 'select',
                options: difficultyOptions,
              },
              { key: 'description', label: 'Description (optional)' },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              if (!data.departmentId) return Promise.reject({ response: { data: { message: 'Department is required' } } });
              return subjectsApi.create({
                ...data,
                credits: data.credits ? Number(data.credits) : undefined,
                weeklyHours: data.weeklyHours ? Number(data.weeklyHours) : undefined,
              });
            }
          : undefined
      }
      editFields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type', type: 'select', options: typeOptions },
        { key: 'weeklyHours', label: 'Hours/Week', type: 'number' },
        { key: 'difficulty', label: 'Difficulty', type: 'select', options: difficultyOptions },
        { key: 'credits', label: 'Credits', type: 'number' },
      ]}
      updateFn={(id, data) => subjectsApi.update(id, data)}
      removeFn={(id) => subjectsApi.remove(id)}
    />
  );
}
