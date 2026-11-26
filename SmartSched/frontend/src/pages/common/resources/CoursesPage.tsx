import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { coursesApi, departmentsApi, institutesApi } from '@/api';
import { ResourcePage, useInstituteScope } from '../ResourcePage';
import { Button, Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';

type Subject = {
  id: string;
  code: string;
  name: string;
  credits: number;
  weeklyHours: number;
  type: string;
  departmentId: string;
};

type Course = {
  id: string;
  code: string;
  name: string;
  totalCredits: number;
  semesterNo: number;
  departmentId: string;
  department?: { code: string; name: string };
  courseSubjects?: { subject: Subject }[];
};

export function CoursesPage() {
  const qc = useQueryClient();
  const { user, instituteId } = useInstituteScope();
  const isAdmin = user?.role?.name === 'ADMIN';
  const canCreate =
    user?.role?.name === 'ADMIN' ||
    user?.role?.name === 'INSTITUTE_ADMIN' ||
    user?.role?.name === 'DEPARTMENT_HEAD';

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

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
  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: `${d.code} — ${d.name}`,
    meta: { instituteId: d.instituteId ?? '' },
  }));

  // Fetch subjects for the selected course's department
  const { data: availableSubjects, isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['course-subjects', selectedCourse?.id],
    queryFn: async () => {
      if (!selectedCourse?.id) return [];
      return (await coursesApi.getCourseSubjects(selectedCourse.id)).data.data as Subject[];
    },
    enabled: !!selectedCourse?.id,
  });

  // Initialise checkboxes from current course subjects when modal opens
  useEffect(() => {
    if (selectedCourse) {
      const current = (selectedCourse.courseSubjects ?? []).map((cs) => cs.subject.id);
      setSelectedSubjectIds(current);
    } else {
      setSelectedSubjectIds([]);
    }
  }, [selectedCourse]);

  // Live credit total
  const totalCredits = useMemo(() => {
    if (!availableSubjects) return 0;
    return availableSubjects
      .filter((s) => selectedSubjectIds.includes(s.id))
      .reduce((sum, s) => sum + (s.credits ?? 0), 0);
  }, [availableSubjects, selectedSubjectIds]);

  const updateSubjectsMutation = useMutation({
    mutationFn: async ({ courseId, subjectIds }: { courseId: string; subjectIds: string[] }) => {
      await coursesApi.update(courseId, { subjectIds });
    },
    onSuccess: () => {
      toast.success('Course subjects updated & credits recalculated!');
      qc.invalidateQueries({ queryKey: ['courses'] });
      setSelectedCourse(null);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Failed to update subjects');
    },
  });

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="relative">
      <ResourcePage
        title="Courses"
        queryKey="courses"
        listFn={async (search, page, limit, departmentId) =>
          (await coursesApi.list({
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
          {
            key: 'department',
            label: 'Department',
            render: (r) => (r.department as { code?: string })?.code ?? '—',
          },
          { key: 'semesterNo', label: 'Semester' },
          {
            key: 'totalCredits',
            label: 'Total Credits',
            render: (r) => {
              const count = (r.courseSubjects as any[])?.length ?? 0;
              const credits = r.totalCredits as number;
              return (
                <span className={cn('font-semibold', credits > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                  {credits} cr
                  {count > 0 && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({count} subj)</span>
                  )}
                </span>
              );
            },
          },
          {
            key: 'assign_subjects',
            label: 'Subjects',
            render: (r) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedCourse(r as unknown as Course)}
              >
                Assign Subjects
              </Button>
            ),
          },
        ]}
        createFields={
          canCreate
            ? [
                { key: 'code', label: 'Course Code (e.g. BCE101)' },
                { key: 'name', label: 'Course Name' },
                ...(isAdmin
                  ? [{ key: 'instituteId', label: 'Institute', type: 'select' as const, options: instituteOptions }]
                  : []),
                {
                  key: 'departmentId',
                  label: 'Department',
                  type: 'select' as const,
                  options: departmentOptions,
                  ...(isAdmin ? { dependsOn: { field: 'instituteId', metaKey: 'instituteId' } } : {}),
                },
                { key: 'semesterNo', label: 'Semester No.', type: 'number' as const },
                { key: 'description', label: 'Description (optional)' },
              ]
            : undefined
        }
        createFn={
          canCreate
            ? (data) => {
                if (!data.departmentId)
                  return Promise.reject({ response: { data: { message: 'Department is required' } } });
                if (!data.semesterNo)
                  return Promise.reject({ response: { data: { message: 'Semester number is required' } } });
                return coursesApi.create({
                  ...data,
                  semesterNo: Number(data.semesterNo),
                  totalCredits: 0,
                });
              }
            : undefined
        }
        editFields={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'semesterNo', label: 'Semester', type: 'number' },
          { key: 'totalCredits', label: 'Total Credits', type: 'number' },
          { key: 'description', label: 'Description' },
        ]}
        updateFn={(id, data) => {
          return coursesApi.update(id, {
            ...data,
            semesterNo: data.semesterNo ? Number(data.semesterNo) : undefined,
            totalCredits: data.totalCredits !== undefined && data.totalCredits !== '' ? Number(data.totalCredits) : undefined,
          });
        }}
        removeFn={(id) => coursesApi.remove(id)}
      />

      {/* Subject Assignment Modal */}
      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedCourse(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-assign-title"
            onClick={(e) => e.stopPropagation()}
            className="surface-card w-full max-w-2xl max-h-[85vh] flex flex-col p-6 space-y-4 overflow-hidden shadow-2xl rounded-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-start gap-3 border-b border-border pb-3">
              <div>
                <h2 id="course-assign-title" className="text-lg font-bold font-display text-foreground">
                  Assign Subjects
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {selectedCourse.code} — {selectedCourse.name} · Semester {selectedCourse.semesterNo}
                </p>
                <p className="text-xs text-muted">
                  Dept: {selectedCourse.department?.code ?? '—'} · Showing subjects from this department
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setSelectedCourse(null)}
                aria-label="Close subject assignment modal"
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </div>

            {/* Live Credit Counter */}
            <div className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-2.5 border text-sm font-medium transition-colors',
              totalCredits > 0
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
            )}>
              <span className="font-display text-2xl font-bold tabular-nums">{totalCredits}</span>
              <div>
                <div>Total Credits (auto-calculated)</div>
                <div className="text-xs font-normal opacity-80">
                  {selectedSubjectIds.length} subject{selectedSubjectIds.length !== 1 ? 's' : ''} selected
                  {selectedCourse.totalCredits > 0 && totalCredits !== selectedCourse.totalCredits && (
                    <span className="ml-2 font-medium">
                      (was {selectedCourse.totalCredits} cr)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Subject List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 py-1">
              {isLoadingSubjects ? (
                <div className="space-y-2 py-4">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <div className="grid gap-2">
                  {(availableSubjects ?? []).length === 0 ? (
                    <p className="text-center text-sm text-muted py-8">
                      No subjects found for this department. Create subjects first.
                    </p>
                  ) : (
                    (availableSubjects ?? []).map((s) => {
                      const isChecked = selectedSubjectIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer transition-colors hover:bg-surface-subtle/60',
                            isChecked && 'border-primary/50 bg-primary/5 dark:bg-blue-500/10'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSubject(s.id)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate">
                              {s.code} — {s.name}
                            </div>
                            <div className="text-xs text-muted flex gap-3 mt-0.5">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded font-semibold text-[10px]',
                                s.type === 'LAB'
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                  : 'bg-blue-500/12 text-blue-700 dark:text-blue-300'
                              )}>
                                {s.type}
                              </span>
                              <span className="tabular-nums">{s.weeklyHours} hrs/week</span>
                            </div>
                          </div>
                          <div className={cn(
                            'text-right shrink-0 tabular-nums',
                            isChecked ? 'text-primary dark:text-cyan-accent font-bold' : 'text-muted'
                          )}>
                            <div className="text-sm font-semibold">{s.credits} cr</div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center gap-2 border-t border-border pt-4">
              <div className="text-xs text-muted tabular-nums">
                Credits will be auto-saved as <strong className="text-foreground">{totalCredits}</strong>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedCourse(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    updateSubjectsMutation.mutate({
                      courseId: selectedCourse.id,
                      subjectIds: selectedSubjectIds,
                    })
                  }
                  disabled={updateSubjectsMutation.isPending}
                  loading={updateSubjectsMutation.isPending}
                >
                  {updateSubjectsMutation.isPending ? 'Saving…' : `Save (${totalCredits} cr)`}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
