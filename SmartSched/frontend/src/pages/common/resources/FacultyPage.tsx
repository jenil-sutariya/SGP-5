import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { departmentsApi, institutesApi, facultyApi, coursesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';
import { Button, Card, Skeleton } from '@/components/ui';
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

  // Fetch all course offerings (subjects)
  const { data: offerings, isLoading: isLoadingOfferings } = useQuery({
    queryKey: ['offerings'],
    queryFn: async () => (await coursesApi.listOfferings()).data.data as any[],
  });

  // Fetch current assignments for the selected faculty member
  const { data: currentAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['faculty-assignments', selectedFaculty?.id],
    queryFn: async () => {
      if (!selectedFaculty?.id) return [];
      return (await facultyApi.getAssignments(selectedFaculty.id)).data.data as any[];
    },
    enabled: !!selectedFaculty?.id,
  });

  // Sync state when assignments load
  useEffect(() => {
    if (currentAssignments) {
      setSelectedOfferings(currentAssignments.map((a: any) => a.courseOfferingId));
    } else {
      setSelectedOfferings([]);
    }
  }, [currentAssignments, selectedFaculty]);

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

  // Filter offerings to only show those belonging to the selected faculty's department
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
          (await facultyApi.list({
            search,
            page,
            limit,
            ...(departmentId ? { departmentId } : {}),
            ...(instituteId ? { instituteId } : {}),
          })).data
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedFaculty(r)}
              >
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
                ...(isAdmin ? [{ key: 'instituteId', label: 'Institute', type: 'select' as const, options: instituteOptions }] : []),
                {
                  key: 'departmentId',
                  label: 'Department',
                  type: 'select' as const,
                  options: departmentOptions,
                  ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
                },
                { key: 'designation', label: 'Designation', type: 'select' as const, options: designationOptions },
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
                if (!data.employeeId) return Promise.reject({ response: { data: { message: 'Employee ID is required' } } });
                if (!data.email) return Promise.reject({ response: { data: { message: 'Email is required' } } });
                if (!data.firstName) return Promise.reject({ response: { data: { message: 'First name is required' } } });
                if (!data.lastName) return Promise.reject({ response: { data: { message: 'Last name is required' } } });
                if (!data.departmentId) return Promise.reject({ response: { data: { message: 'Department is required' } } });
                if (!data.designation) return Promise.reject({ response: { data: { message: 'Designation is required' } } });

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col p-6 space-y-4 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-border">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xl font-bold font-display text-foreground">
                Assign Subjects to Prof. {selectedFaculty.user?.firstName} {selectedFaculty.user?.lastName}
              </h3>
              <div className="text-xs font-normal text-muted-foreground mt-0.5">
                Dept: {selectedFaculty.department?.code ?? selectedFaculty.department?.name ?? '—'} · Only showing subjects from this department
              </div>
              <button
                onClick={() => setSelectedFaculty(null)}
                className="text-muted-foreground hover:text-foreground text-lg font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 py-2">
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
                          "flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50",
                          isChecked && "border-primary/50 bg-primary/5 dark:bg-primary/10"
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
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="font-semibold text-sm">
                            {o.subject?.code} — {o.subject?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Course: {o.course?.name} ({o.course?.code}) | Semester {o.semester?.name}
                            {o.section ? ` | Section: ${o.section.code}` : ''}
                            {o.subject?.type ? ` (${o.subject.type})` : ''}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {filteredOfferings.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No course offerings found for this department. Make sure subjects are created and assigned to this department first.
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
              >
                {updateAssignmentsMutation.isPending ? 'Saving...' : 'Save Assignments'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
