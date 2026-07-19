import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentsApi, institutesApi, studentsApi, sectionsApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';

export function StudentsPage() {
  const { user, instituteId } = useInstituteScope();
  const isAdmin = user?.role?.name === 'ADMIN';
  const canCreate =
    user?.role?.name === 'ADMIN' ||
    user?.role?.name === 'INSTITUTE_ADMIN' ||
    user?.role?.name === 'DEPARTMENT_HEAD';

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

  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  const { data: institutes } = useQuery({
    queryKey: ['institutes'],
    queryFn: async () => (await institutesApi.list()).data.data as { id: string; code: string; name: string }[],
    enabled: canCreate,
  });

  const instituteOptions = (institutes ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: async () => (await sectionsApi.list({ limit: 100 })).data.data as { id: string; code: string; name: string; departmentId: string }[],
  });

  const sectionOptions = (sections ?? []).map((s) => ({
    value: s.id,
    label: s.code || s.name,
    meta: { departmentId: s.departmentId ?? '' },
  }));

  const activeOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  const [deptFilter, setDeptFilter] = React.useState('');

  return (
    <ResourcePage
      title="Students"
      queryKey="students"
      extraQueryKey={[deptFilter]}
      filters={[
        {
          key: 'departmentId',
          label: 'Department',
          options: departmentOptions,
          value: deptFilter,
          onChange: setDeptFilter,
        },
      ]}
      listFn={async (search, page, limit) => {
        const res = await studentsApi.list({ page, limit, search, ...(deptFilter ? { departmentId: deptFilter } : {}) });
        return {
          data: res.data.data,
          total: res.data.meta?.pagination?.total ?? res.data.data.length,
        };
      }}
      columns={[
        { key: 'enrollmentNo', label: 'Enrollment' },
        {
          key: 'name',
          label: 'Name',
          render: (r) => {
            const u = r.user as { firstName: string; lastName: string };
            return `${u.firstName} ${u.lastName}`;
          },
        },
        {
          key: 'section',
          label: 'Section',
          render: (r) => (r.section as { code?: string })?.code ?? '—',
        },
        { key: 'batchYear', label: 'Batch' },
        { key: 'currentSemester', label: 'Semester' },
        {
          key: 'isActive',
          label: 'Status',
          render: (r) => (r.isActive ? 'Active' : 'Inactive'),
        },
      ]}
      createFields={
        canCreate
          ? [
              { key: 'enrollmentNo', label: 'Enrollment No.' },
              { key: 'email', label: 'Email' },
              { key: 'firstName', label: 'First name' },
              { key: 'lastName', label: 'Last name' },
              { key: 'phone', label: 'Phone (optional)' },
              ...(isAdmin ? [{ key: 'instituteId', label: 'Institute', type: 'select' as const, options: instituteOptions }] : []),
              {
                key: 'departmentId',
                label: 'Department',
                type: 'select' as const,
                options: departmentOptions,
                ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
              },
              {
                key: 'sectionId',
                label: 'Section (optional)',
                type: 'select' as const,
                options: sectionOptions,
                dependsOn: { field: 'departmentId', metaKey: 'departmentId' },
              },
              { key: 'batchYear', label: 'Batch Year', type: 'number' as const },
              { key: 'currentSemester', label: 'Current Semester (optional)', type: 'number' as const },
            ]
          : undefined
      }
      createFn={
        canCreate
          ? (data) => {
              if (!data.departmentId) return Promise.reject({ response: { data: { message: 'Department is required' } } });
              if (!data.enrollmentNo) return Promise.reject({ response: { data: { message: 'Enrollment number is required' } } });
              if (!data.email) return Promise.reject({ response: { data: { message: 'Email is required' } } });
              if (!data.firstName) return Promise.reject({ response: { data: { message: 'First name is required' } } });
              if (!data.lastName) return Promise.reject({ response: { data: { message: 'Last name is required' } } });
              if (!data.batchYear) return Promise.reject({ response: { data: { message: 'Batch year is required' } } });
              return studentsApi.create({
                enrollmentNo: data.enrollmentNo,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                departmentId: data.departmentId,
                batchYear: Number(data.batchYear),
                currentSemester: data.currentSemester ? Number(data.currentSemester) : undefined,
                sectionId: data.sectionId || undefined,
                phone: data.phone || undefined,
              });
            }
          : undefined
      }
      editFields={[
        { key: 'currentSemester', label: 'Current Semester', type: 'number' },
        { key: 'sectionId', label: 'Section', type: 'select', options: sectionOptions },
        { key: 'isActive', label: 'Status', type: 'select', options: activeOptions },
      ]}
      updateFn={(id, data) =>
        studentsApi.update(id, {
          currentSemester: Number(data.currentSemester),
          sectionId: data.sectionId || null,
          isActive: data.isActive === 'true',
        })
      }
      removeFn={(id) => studentsApi.remove(id)}
    />
  );
}
