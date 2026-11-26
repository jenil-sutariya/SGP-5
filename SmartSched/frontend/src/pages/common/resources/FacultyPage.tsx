import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { departmentsApi, institutesApi, facultyApi, coursesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';
import { Button, Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';

export function FacultyPage() {
  const { user, instituteId } = useInstituteScope();
  const isAdmin = user?.role?.name === 'ADMIN';
  const canCreate =
    user?.role?.name === 'ADMIN' ||
    user?.role?.name === 'INSTITUTE_ADMIN' ||
    user?.role?.name === 'DEPARTMENT_HEAD';

  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);
  const [selectedOfferings, setSelectedOfferings] = useState<string[]>([]);

  const { data: departments } = useQuery({
    queryKey: ['departments', 'scoped', instituteId ?? 'all'],
    queryFn: async () => {
      try {
        const res = await departmentsApi.list({
          limit: 100,
          ...(instituteId ? { instituteId } : {}),
        });
        const raw = (res as any)?.data?.data ?? (res as any)?.data ?? [];
        const items = Array.isArray(raw) ? raw : (raw.items ?? raw.data ?? []);
        if (items.length > 0)
          return items as { id: string; code: string; name: string; instituteId: string }[];
        const fallbackRes = await departmentsApi.list({ limit: 100 });
        const fallbackRaw = (fallbackRes as any)?.data?.data ?? (fallbackRes as any)?.data ?? [];
        return (Array.isArray(fallbackRaw)
          ? fallbackRaw
          : (fallbackRaw.items ?? fallbackRaw.data ?? [])) as {
          id: string;
          code: string;
          name: string;
          instituteId: string;
        }[];
      } catch {
        try {
          const fallbackRes = await departmentsApi.list({ limit: 100 });
          const fallbackRaw = (fallbackRes as any)?.data?.data ?? (fallbackRes as any)?.data ?? [];
          return (Array.isArray(fallbackRaw)
            ? fallbackRaw
            : (fallbackRaw.items ?? fallbackRaw.data ?? [])) as {
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

  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  const { data: institutes } = useQuery({
    queryKey: ['institutes'],
    queryFn: async () =>
      (await institutesApi.list()).data.data as { id: string; code: string; name: string }[],
    enabled: canCreate,
  });

  const instituteOptions = (institutes ?? []).map((i) => ({
    value: i.id,
    label: `${i.code} — ${i.name}`,
  }));

  const designationOptions = [
    { value: 'Professor', label: 'Professor' },
    { value: 'Associate Professor', label: 'Associate Professor' },
    { value: 'Assistant Professor', label: 'Assistant Professor' },
    { value: 'Lecturer', label: 'Lecturer' },
  ];

  const activeOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  const { data: offerings, isLoading: isLoadingOfferings } = useQuery({
    queryKey: ['offerings'],
    queryFn: async () => (await coursesApi.listOfferings()).data.data as any[],
  });

  const { data: currentAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['faculty-assignments', selectedFaculty?.id],
    queryFn: async () => {
      if (!selectedFaculty?.id) return [];
      return (await facultyApi.getAssignments(selectedFaculty.id)).data.data as any[];
    },
    enabled: !!selectedFaculty?.id,
  });

  useEffect(() => {
    if (currentAssignments) {
      setSelectedOfferings(currentAssignments.map((a: any) => a.courseOfferingId));
    } else {
      setSelectedOfferings([]);
    }
  }, [currentAssignments, selectedFaculty]);

  useEffect(() => {
    if (!selectedFaculty) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedFaculty(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedFaculty]);

  const updateAssignmentsMutation = useMutation({
    mutationFn: async ({ facultyId, offeringIds }: { facultyId: string; offeringIds: string[] }) => {
      await facultyApi.updateAssignments(facultyId, offeringIds);
    },
    onSuccess: () => {
      toast.success('Subject assignments updated successfully');
      setSelectedFaculty(null);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Failed to update assignments');
    },
  });

  const filteredOfferings = React.useMemo(() => {
    if (!selectedFaculty || !offerings) return [];
    const facultyDeptId = selectedFaculty.departmentId as string;
    return offerings.filter((o: any) => {
      const subjectDeptId = o.subject?.departmentId;
      const courseDeptId = o.course?.departmentId;
      return subjectDeptId === facultyDeptId || courseDeptId === facultyDeptId;
    });
  }, [offerings, selectedFaculty]);

  return (
    <div className="relative">
      <ResourcePage
        title="Professors"
        queryKey="faculty"
        listFn={async (search, page, limit, departmentId) =>
          (
            await facultyApi.list({
              search,
              page,
              limit,
              ...(departmentId ? { departmentId } : {}),
              ...(instituteId ? { instituteId } : {}),
            })
          ).data
        }
        columns={[
          { key: 'employeeId', label: 'Employee ID' },
          {
            key: 'name',
            label: 'Name',
            render: (r) => {
              const u = r.user as { firstName: string; lastName: string; email: string };
              return `${u.firstName} ${u.lastName}`;
            },
          },
          { key: 'designation', label: 'Designation' },
          {
            key: 'department',
            label: 'Department',
            render: (r) => (r.department as { code: string })?.code,
          },
          {
            key: 'isActive',
            label: 'Status',
            render: (r) => (r.isActive ? 'Active' : 'Inactive'),
          },
          {
            key: 'assign_subjects',
            label: 'Subjects',
            render: (r) => (
              <Button size="sm" variant="outline" onClick={() => setSelectedFaculty(r)}>
                Assign Subjects
              </Button>
            ),
          },
        ]}
        createFields={
          canCreate
            ? [
                { key: 'employeeId', label: 'Employee ID' },
                { key: 'email', label: 'Email' },
                { key: 'firstName', label: 'First name' },
                { key: 'lastName', label: 'Last name' },
                ...(isAdmin
                  ? [
                      {
                        key: 'instituteId',
                        label: 'Institute',
                        type: 'select' as const,
                        options: instituteOptions,
                      },
                    ]
                  : []),
                {
                  key: 'departmentId',
                  label: 'Department',
                  type: 'select' as const,
                  options: departmentOptions,
                  ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
                },
                {
                  key: 'designation',
                  label: 'Designation',
                  type: 'select' as const,
                  options: designationOptions,
                },
                { key: 'specialization', label: 'Specialization' },
                { key: 'phone', label: 'Phone' },
                { key: 'maxHoursPerWeek', label: 'Max Hours Per Week', type: 'number' as const },
                { key: 'maxHoursPerDay', label: 'Max Hours Per Day', type: 'number' as const },
              ]
            : undefined
        }
        createFn={
          canCreate
            ? (data) => {
                if (!data.employeeId)
                  return Promise.reject({ response: { data: { message: 'Employee ID is required' } } });
                if (!data.email)
                  return Promise.reject({ response: { data: { message: 'Email is required' } } });
                if (!data.firstName)
                  return Promise.reject({ response: { data: { message: 'First name is required' } } });
                if (!data.lastName)
                  return Promise.reject({ response: { data: { message: 'Last name is required' } } });
                if (!data.departmentId)
                  return Promise.reject({ response: { data: { message: 'Department is required' } } });
                if (!data.designation)
                  return Promise.reject({ response: { data: { message: 'Designation is required' } } });

                return facultyApi.create({
                  employeeId: data.employeeId,
                  email: data.email,
                  firstName: data.firstName,
                  lastName: data.lastName,
                  departmentId: data.departmentId,
                  designation: data.designation,
                  specialization: data.specialization || undefined,
                  phone: data.phone || undefined,
                  maxHoursPerWeek: data.maxHoursPerWeek ? Number(data.maxHoursPerWeek) : undefined,
                  maxHoursPerDay: data.maxHoursPerDay ? Number(data.maxHoursPerDay) : undefined,
                });
              }
            : undefined
        }
        editFields={[
          { key: 'designation', label: 'Designation', type: 'select', options: designationOptions },
          { key: 'specialization', label: 'Specialization' },
          { key: 'departmentId', label: 'Department', type: 'select', options: departmentOptions },
          { key: 'maxHoursPerWeek', label: 'Max Hours Per Week', type: 'number' },
          { key: 'maxHoursPerDay', label: 'Max Hours Per Day', type: 'number' },
          { key: 'isActive', label: 'Status', type: 'select', options: activeOptions },
        ]}
        updateFn={(id, data) =>
          facultyApi.update(id, {
            designation: data.designation,
            specialization: data.specialization || null,
            departmentId: data.departmentId,
            maxHoursPerWeek: data.maxHoursPerWeek ? Number(data.maxHoursPerWeek) : undefined,
            maxHoursPerDay: data.maxHoursPerDay ? Number(data.maxHoursPerDay) : undefined,
            isActive: data.isActive === 'true',
          })
        }
        removeFn={(id) => facultyApi.remove(id)}
      />

      {/* Subject Assignment Modal */}
      {selectedFaculty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedFaculty(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-subjects-title"
            onClick={(e) => e.stopPropagation()}
            className="surface-card w-full max-w-2xl max-h-[85vh] flex flex-col p-6 space-y-4 overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="flex justify-between items-start gap-3 border-b border-border pb-3">
              <div>
                <h2 id="assign-subjects-title" className="text-lg font-bold font-display text-foreground">
                  Assign Subjects — Prof. {selectedFaculty.user?.firstName}{' '}
                  {selectedFaculty.user?.lastName}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Dept: {selectedFaculty.department?.code ?? selectedFaculty.department?.name ?? '—'}{' '}
                  · Showing subjects from this department
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setSelectedFaculty(null)}
                aria-label="Close subject assignment modal"
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 py-1">
              {isLoadingOfferings || isLoadingAssignments ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredOfferings.map((o: any) => {
                    const isChecked = selectedOfferings.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer transition-colors hover:bg-surface-subtle/60',
                          isChecked && 'border-primary/50 bg-primary/5 dark:bg-blue-500/10'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedOfferings(selectedOfferings.filter((id) => id !== o.id));
                            } else {
                              setSelectedOfferings([...selectedOfferings, o.id]);
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="font-semibold text-sm text-foreground">
                            {o.subject?.code} — {o.subject?.name}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            Course: {o.course?.name} ({o.course?.code}) · Semester{' '}
                            {o.semester?.name}
                            {o.section ? ` · Section ${o.section.code}` : ''}
                            {o.subject?.type ? ` (${o.subject.type})` : ''}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {filteredOfferings.length === 0 && (
                    <p className="text-center text-sm text-muted py-8">
                      No course offerings found for this department. Create subjects and assign them
                      to this department first.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setSelectedFaculty(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateAssignmentsMutation.mutate({
                    facultyId: selectedFaculty.id,
                    offeringIds: selectedOfferings,
                  })
                }
                disabled={updateAssignmentsMutation.isPending}
                loading={updateAssignmentsMutation.isPending}
              >
                {updateAssignmentsMutation.isPending ? 'Saving…' : 'Save Assignments'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
