import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { academicApi, departmentsApi, sectionsApi, schedulerApi, timetableApi } from '@/api';
import { Button, Card, Input, Label, Badge } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

type Year     = { id: string; name: string; isCurrent: boolean };
type Semester = { id: string; name: string; isCurrent: boolean; academicYearId: string };
type Dept     = { id: string; name: string; code: string };
type Section  = { id: string; name: string; departmentId: string | null };

export default function SchedulerPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const instituteId = user?.role?.name === 'ADMIN' ? undefined : (user?.instituteId ?? undefined);

  // ── Form state ────────────────────────────────────────────────────────────
  const [name,       setName]       = useState('');
  const [yearId,     setYearId]     = useState('');
  const [semId,      setSemId]      = useState('');
  const [deptId,     setDeptId]     = useState('');
  const [sectionId,  setSectionId]  = useState('');
  const [useGenetic, setUseGenetic] = useState(true);
  const [resultId,   setResultId]   = useState('');
  const [submitErr,  setSubmitErr]  = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────
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
  });
  // Sections filtered by selected department
  const { data: sections } = useQuery({
    queryKey: ['sections', deptId || 'all'],
    queryFn: async () =>
      (await sectionsApi.list({
        limit: 100,
        ...(deptId ? { departmentId: deptId } : {}),
      })).data.data as Section[],
    staleTime: 0,
  });

  // ── Auto-select current year ──────────────────────────────────────────────
  useEffect(() => {
    if (!years?.length) return;
    const cur = years.find((y) => y.isCurrent) ?? years[0];
    setYearId(cur.id);
  }, [years]);

  // ── Semesters filtered to selected year ───────────────────────────────────
  const filteredSemesters = (semesters ?? []).filter(
    (s) => !yearId || s.academicYearId === yearId
  );

  // ── Auto-select current semester ──────────────────────────────────────────
  useEffect(() => {
    if (!filteredSemesters.length) return;
    const cur = filteredSemesters.find((s) => s.isCurrent) ?? filteredSemesters[0];
    setSemId(cur.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId, semesters]);

  // ── Reset section when department changes ──────────────────────────────────
  useEffect(() => {
    setSectionId('');
  }, [deptId]);

  // ── Scheduler status ──────────────────────────────────────────────────────
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

  // ── Generate mutation ─────────────────────────────────────────────────────
  const generate = useMutation({
    mutationFn: () => {
      if (!yearId) throw new Error('Select an academic year');
      if (!semId)  throw new Error('Select a semester');
      return schedulerApi.generate({
        name: name || undefined,
        academicYearId: yearId,
        semesterId:     semId,
        departmentId:   deptId    || null,
        sectionId:      sectionId || null,
        useGenetic,
      });
    },
    onSuccess: (res) => {
      const tt = res.data.data;
      setResultId(tt.id);
      sessionStorage.setItem('selected-timetable-id', tt.id);
      qc.invalidateQueries({ queryKey: ['timetables'] });
      toast.success(`Generated! Score ${tt.score ?? 0} — view on Timetable page`);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { message?: string })?.message ??
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Generation failed';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErr('');
    if (!yearId) { setSubmitErr('Please select an academic year'); return; }
    if (!semId)  { setSubmitErr('Please select a semester'); return; }
    generate.mutate();
  };

  const selectClass =
    'h-10 w-full rounded-xl border border-border bg-white/60 px-3 text-sm dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-primary/40';

  // Scope label for generate button
  const scopeLabel = sectionId
    ? `section ${(sections ?? []).find((s) => s.id === sectionId)?.name ?? ''}`
    : deptId
    ? `${(departments ?? []).find((d) => d.id === deptId)?.code ?? ''} dept`
    : 'all sections';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Scheduler Engine</h2>
        <p className="text-sm text-muted">CSP + greedy backtracking + genetic optimization</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <Card>
          <h3 className="mb-4 font-semibold">Generate Timetable</h3>
          <form className="space-y-4" onSubmit={handleSubmit}>

            <div className="space-y-2">
              <Label htmlFor="tt-name">Name (optional)</Label>
              <Input
                id="tt-name"
                placeholder="e.g. CSE Odd 2025-26"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tt-year">Academic Year</Label>
                <select
                  id="tt-year"
                  className={selectClass}
                  value={yearId}
                  onChange={(e) => setYearId(e.target.value)}
                >
                  <option value="">Select year…</option>
                  {(years ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}{y.isCurrent ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-sem">Semester</Label>
                <select
                  id="tt-sem"
                  className={selectClass}
                  value={semId}
                  onChange={(e) => setSemId(e.target.value)}
                >
                  <option value="">Select semester…</option>
                  {filteredSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.isCurrent ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Department + Section row */}
            <div className="space-y-1">
              <Label>Scope</Label>
              <div className="rounded-xl border border-border/60 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Department</p>
                  <select
                    id="tt-dept"
                    className={selectClass}
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {(departments ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Division / Section
                    {!deptId && (
                      <span className="ml-1 opacity-50">(select a department first to filter)</span>
                    )}
                  </p>
                  <select
                    id="tt-section"
                    className={selectClass}
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
                  </select>
                </div>

                <p className="text-xs text-muted-foreground">
                  {sectionId
                    ? '📌 Will generate timetable only for this division'
                    : deptId
                    ? '🏛 Will generate for all divisions in this department'
                    : '🌐 Will generate for every section across all departments'}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={useGenetic}
                onChange={(e) => setUseGenetic(e.target.checked)}
              />
              Use genetic algorithm polish
            </label>

            {submitErr && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {submitErr}
              </p>
            )}

            <Button type="submit" disabled={generate.isPending} className="w-full">
              {generate.isPending
                ? 'Generating…'
                : `Generate Timetable — ${scopeLabel}`}
            </Button>
          </form>
        </Card>

        {/* ── Result panel ─────────────────────────────────────────────────── */}
        <Card>
          <h3 className="mb-4 font-semibold">Result</h3>

          {status ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{status.status}</Badge>
                <Badge variant="secondary">Entries {status._count?.entries ?? 0}</Badge>
                <Badge variant="warning">Conflicts {status._count?.conflicts ?? 0}</Badge>
                {status.score != null && <Badge variant="success">Score {status.score}</Badge>}
              </div>

              {(status.metadata?.unassigned?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <strong>{status.metadata.unassigned.length} sessions unscheduled</strong>
                  <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                    {status.metadata.unassigned.map(
                      (u: { subjectCode: string; isLab: boolean }, i: number) => (
                        <div key={i}>
                          {u.subjectCode} {u.isLab ? '(Lab)' : '(Theory)'}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={async () => {
                    await schedulerApi.optimize(resultId);
                    qc.invalidateQueries({ queryKey: ['scheduler-status', resultId] });
                    toast.success('Optimization started');
                  }}
                >
                  Optimize
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={async () => {
                    const res = await schedulerApi.resolveConflicts(resultId);
                    toast.success(`Resolved ${res.data.data.resolved}`);
                    qc.invalidateQueries({ queryKey: ['conflicts', resultId] });
                  }}
                >
                  Resolve Conflicts
                </Button>
                <Link to="/timetable">
                  <Button variant="outline" size="sm">View Timetable →</Button>
                </Link>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto">
                {(conflicts ?? status.conflicts ?? []).map(
                  (c: { id: string; type: string; severity: string; description: string }) => (
                    <div key={c.id} className="rounded-xl border border-border/60 p-3 text-sm">
                      <div className="mb-1 flex gap-2">
                        <Badge variant={c.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                          {c.severity}
                        </Badge>
                        <span className="font-medium">{c.type}</span>
                      </div>
                      <p className="text-xs text-muted">{c.description}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted space-y-2">
              <p>Generate a timetable to see results and conflicts.</p>
              <p className="text-xs opacity-60">
                Select a specific division to generate just that section's timetable.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
