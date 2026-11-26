import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  academicApi,
  institutesApi,
  departmentsApi,
  sectionsApi,
  schedulerApi,
  timetableApi,
} from '@/api';
import { Button, Input, Label, Badge, Select } from '@/components/ui';
import { GlassCard } from '@/components/common/GlassCard';
import { InstituteBadge } from '@/components/common/InstituteBadge';
import { useAuthStore } from '@/store/authStore';
import { TIMETABLE_GENERATION_KEY } from '@/lib/timetableGeneration';

type Year = { id: string; name: string; isCurrent: boolean };
type Semester = { id: string; name: string; isCurrent: boolean; academicYearId: string };
type Dept = { id: string; name: string; code: string };
type Section = { id: string; name: string; departmentId: string | null };

export default function SchedulerPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [selectedInstituteId, setSelectedInstituteId] = useState('');
  const isAdmin = user?.role?.name === 'ADMIN';
  const instituteId = isAdmin ? selectedInstituteId || undefined : (user?.instituteId ?? undefined);

  const { data: institutes } = useQuery({
    queryKey: ['scheduler-institutes'],
    enabled: isAdmin,
    queryFn: async () =>
      (await institutesApi.list()).data.data as { id: string; code: string; name: string }[],
  });

  const [name, setName] = useState('');
  const [yearId, setYearId] = useState('');
  const [semId, setSemId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [useGenetic, setUseGenetic] = useState(true);
  const [resultId, setResultId] = useState('');
  const [submitErr, setSubmitErr] = useState('');

  const { data: years } = useQuery({
    queryKey: ['years'],
    queryFn: async () => (await academicApi.years({ limit: 100 })).data.data as Year[],
    staleTime: 0,
  });

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: async () => (await academicApi.semesters({ limit: 100 })).data.data as Semester[],
    staleTime: 0,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'scoped', instituteId ?? 'all'],
    queryFn: async () =>
      (await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data
        .data as Dept[],
    staleTime: 0,
    enabled: !!instituteId,
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', deptId || 'all', instituteId || 'all'],
    queryFn: async () =>
      (
        await sectionsApi.list({
          limit: 100,
          ...(deptId ? { departmentId: deptId } : {}),
          ...(instituteId ? { instituteId } : {}),
        })
      ).data.data as Section[],
    staleTime: 0,
    enabled: !!instituteId,
  });

  useEffect(() => {
    setDeptId('');
    setSectionId('');
  }, [instituteId]);

  useEffect(() => {
    if (!years?.length) return;
    const cur = years.find((y) => y.isCurrent) ?? years[0];
    setYearId(cur.id);
  }, [years]);

  const filteredSemesters = (semesters ?? []).filter((s) => !yearId || s.academicYearId === yearId);

  useEffect(() => {
    if (!filteredSemesters.length) return;
    const cur = filteredSemesters.find((s) => s.isCurrent) ?? filteredSemesters[0];
    setSemId(cur.id);
  }, [yearId, semesters]);

  useEffect(() => {
    setSectionId('');
  }, [deptId]);

  const { data: status } = useQuery({
    queryKey: ['scheduler-status', resultId],
    enabled: !!resultId,
    queryFn: async () => (await schedulerApi.status(resultId)).data.data,
    refetchInterval: (q) => (q.state.data?.status === 'GENERATING' ? 2000 : false),
  });

  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', resultId],
    enabled: !!resultId,
    queryFn: async () => (await timetableApi.conflicts(resultId)).data.data,
  });

  const generate = useMutation({
    mutationKey: TIMETABLE_GENERATION_KEY,
    meta: { returnFocusId: 'generate-timetable-button' },
    retry: false,
    mutationFn: () => {
      if (!yearId) throw new Error('Select an academic year');
      if (!semId) throw new Error('Select a semester');
      if (!instituteId) throw new Error('Select an institute');
      return schedulerApi.generate({
        instituteId,
        name: name || undefined,
        academicYearId: yearId,
        semesterId: semId,
        departmentId: deptId || null,
        sectionId: sectionId || null,
        useGenetic,
      });
    },
    onSuccess: (res) => {
      const tt = res.data.data;
      setResultId(tt.id);
      sessionStorage.setItem('selected-timetable-id', tt.id);
      qc.invalidateQueries({ queryKey: ['timetables'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['scheduler-status', tt.id] });
      qc.invalidateQueries({ queryKey: ['timetable', tt.id] });
      toast.success('Available sessions scheduled. Existing bookings were preserved.');
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e as { message?: string })?.message ??
        'Generation failed';
      toast.error(msg);
    },
  });

  const scheduleRemaining = useMutation({
    mutationKey: TIMETABLE_GENERATION_KEY,
    meta: { returnFocusId: 'schedule-remaining-button' },
    retry: false,
    mutationFn: (timetableId: string) => schedulerApi.optimize(timetableId),
    onSuccess: (res) => {
      const timetableId = res.data.data.id;
      setResultId(timetableId);
      sessionStorage.setItem('selected-timetable-id', timetableId);
      qc.invalidateQueries({ queryKey: ['scheduler-status'] });
      qc.invalidateQueries({ queryKey: ['conflicts'] });
      qc.invalidateQueries({ queryKey: ['timetables'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Missing sessions scheduled; existing bookings kept');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not schedule remaining sessions';
      toast.error(message);
    },
  });

  const checkConflicts = useMutation({
    mutationFn: (timetableId: string) => schedulerApi.resolveConflicts(timetableId),
    onSuccess: (res, timetableId) => {
      toast.info(res.data.data.remaining.length + ' conflicts found. No sessions were deleted.');
      qc.invalidateQueries({ queryKey: ['conflicts', timetableId] });
      qc.invalidateQueries({ queryKey: ['scheduler-status', timetableId] });
    },
    onError: (error: unknown) => {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not check conflicts'
      );
    },
  });

  const isScheduling = generate.isPending || scheduleRemaining.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qc.isMutating({ mutationKey: TIMETABLE_GENERATION_KEY })) return;
    setSubmitErr('');
    if (!instituteId) {
      setSubmitErr('Please select an institute');
      return;
    }
    if (!yearId) {
      setSubmitErr('Please select an academic year');
      return;
    }
    if (!semId) {
      setSubmitErr('Please select a semester');
      return;
    }
    generate.mutate();
  };

  const scopeLabel = sectionId
    ? `section ${(sections ?? []).find((s) => s.id === sectionId)?.name ?? ''}`
    : deptId
      ? `${(departments ?? []).find((d) => d.id === deptId)?.code ?? ''} dept`
      : 'all sections';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <section className="surface-card rounded-2xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
              <Cpu size={20} aria-hidden="true" />
            </div>
            <InstituteBadge code={user?.institute?.code || 'CHARUSAT'} size="md" />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground tracking-tight">
            AI Timetable Scheduler
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Automatically assign lectures and multi-slot labs across available classrooms,
            laboratories, and professors while preserving existing generated and published bookings.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form Panel */}
        <GlassCard
          title="Configure Scheduler"
          subtitle="Set academic period, scope, and optimization"
          headerIcon={<Zap size={18} aria-hidden="true" />}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Step 1: Title & Period */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-cyan-accent">
                1. Title & Academic Period
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="tt-name">Timetable Title (optional)</Label>
                <Input
                  id="tt-name"
                  placeholder="e.g. CSE Odd Semester 2025-26"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tt-year">Academic Year</Label>
                  <Select
                    id="tt-year"
                    value={yearId}
                    onChange={(e) => setYearId(e.target.value)}
                  >
                    <option value="">Select year…</option>
                    {(years ?? []).map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                        {y.isCurrent ? ' (Current)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tt-sem">Semester</Label>
                  <Select
                    id="tt-sem"
                    value={semId}
                    onChange={(e) => setSemId(e.target.value)}
                  >
                    <option value="">Select semester…</option>
                    {filteredSemesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.isCurrent ? ' (Current)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 2: Scope */}
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-cyan-accent">
                2. Target Scope
              </p>
              <div className="rounded-xl border border-border bg-surface-subtle/60 p-4 space-y-3">
                {isAdmin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="tt-institute">Institute</Label>
                    <Select
                      id="tt-institute"
                      value={selectedInstituteId}
                      onChange={(e) => setSelectedInstituteId(e.target.value)}
                    >
                      <option value="">Select institute</option>
                      {(institutes ?? []).map((institute) => (
                        <option key={institute.id} value={institute.id}>
                          {institute.code} — {institute.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="tt-dept">Department</Label>
                  <Select
                    id="tt-dept"
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {(departments ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tt-section">
                    Division / Section
                    {!deptId && (
                      <span className="ml-1.5 text-muted font-normal">
                        (select department to narrow)
                      </span>
                    )}
                  </Label>
                  <Select
                    id="tt-section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                  >
                    <option value="">All divisions in this scope</option>
                    {(sections ?? [])
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 3: Engine */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-cyan-accent">
                3. Optimization Engine
              </p>
              <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-surface-subtle/60 transition-colors">
                <input
                  type="checkbox"
                  checked={useGenetic}
                  onChange={(e) => setUseGenetic(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary"
                />
                <div className="text-sm">
                  <span className="font-semibold text-foreground block">
                    Enable Genetic Algorithm Optimization Polish
                  </span>
                  <span className="text-xs text-muted">
                    Improves distribution of lectures, faculty breaks, and lab placements after CSP
                    assignment.
                  </span>
                </div>
              </label>
            </div>

            {submitErr && (
              <p
                role="alert"
                className="rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-xs font-semibold text-danger"
              >
                {submitErr}
              </p>
            )}

            <Button
              id="generate-timetable-button"
              type="submit"
              size="lg"
              disabled={isScheduling}
              loading={generate.isPending}
              className="w-full font-bold"
            >
              {!generate.isPending && <Sparkles size={17} aria-hidden="true" />}
              {generate.isPending
                ? 'Scheduling available periods…'
                : `Generate missing sessions — ${scopeLabel}`}
            </Button>
          </form>
        </GlassCard>

        {/* Results Panel */}
        <GlassCard
          title="Generation Results"
          subtitle="Saved sessions, quality score, and conflicts"
          headerIcon={<Layers size={18} aria-hidden="true" />}
        >
          {status ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={status.status === 'PUBLISHED' ? 'success' : 'default'}>
                  {status.status}
                </Badge>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  Entries: {status._count?.entries ?? 0}
                </Badge>
                <Badge
                  variant={status._count?.conflicts > 0 ? 'warning' : 'success'}
                  className="font-mono tabular-nums"
                >
                  Conflicts: {status._count?.conflicts ?? 0}
                </Badge>
                {status.score != null && (
                  <Badge variant="success" className="font-mono tabular-nums">
                    Score: {status.score}
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted leading-relaxed">
                {status.metadata?.preservedSessions ?? 0} previously scheduled sessions preserved in
                this scope. Rooms, labs, and faculty booked by other departments remain unavailable
                during their booked periods.
              </p>

              {Array.isArray(status.metadata?.unassigned) && status.metadata.unassigned.length > 0 && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 p-3.5 text-xs text-amber-950 dark:text-amber-200">
                  <strong className="flex items-center gap-1.5 font-bold mb-1.5">
                    <AlertTriangle size={14} aria-hidden="true" />
                    {status.metadata.unassigned.length} unscheduled sessions
                  </strong>
                  <div className="max-h-28 overflow-y-auto space-y-1 font-mono">
                    {status.metadata.unassigned.map(
                      (u: { subjectCode: string; isLab: boolean }, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span>{u.subjectCode}</span>
                          <span className="opacity-80">{u.isLab ? 'Lab' : 'Theory'}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  id="schedule-remaining-button"
                  variant="outline"
                  size="sm"
                  disabled={isScheduling}
                  onClick={() => {
                    if (qc.isMutating({ mutationKey: TIMETABLE_GENERATION_KEY })) return;
                    scheduleRemaining.mutate(resultId);
                  }}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Schedule remaining
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checkConflicts.isPending}
                  onClick={() => checkConflicts.mutate(resultId)}
                >
                  <ShieldCheck size={14} aria-hidden="true" />{' '}
                  {checkConflicts.isPending ? 'Checking…' : 'Check conflicts'}
                </Button>
                <Button asChild size="sm">
                  <Link to="/timetable">
                    Open Timetable <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto pt-2">
                {(Array.isArray(conflicts)
                  ? conflicts
                  : Array.isArray(status.conflicts)
                    ? status.conflicts
                    : []
                ).map(
                  (c: { id: string; type: string; severity: string; description: string }) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-border p-3 text-xs bg-surface-subtle/60"
                    >
                      <div className="mb-1 flex gap-2 items-center">
                        <Badge variant={c.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                          {c.severity}
                        </Badge>
                        <span className="font-semibold text-foreground">{c.type}</span>
                      </div>
                      <p className="text-muted">{c.description}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-surface-subtle flex items-center justify-center text-primary dark:text-cyan-accent">
                <Cpu size={28} aria-hidden="true" />
              </div>
              <p className="font-semibold text-sm text-foreground">
                Ready to generate your schedule
              </p>
              <p className="text-xs max-w-xs leading-relaxed">
                Configure your academic period and scope on the left, then click Generate missing
                sessions for {user?.institute?.code || 'CHARUSAT'}.
              </p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
