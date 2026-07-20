import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Zap, Layers, RefreshCw } from 'lucide-react';
import { academicApi, departmentsApi, sectionsApi, schedulerApi, timetableApi } from '@/api';
import { Button, Input, Label, Badge } from '@/components/ui';
import { GlassCard } from '@/components/common/GlassCard';
import { InstituteBadge } from '@/components/common/InstituteBadge';
import { useAuthStore } from '@/store/authStore';

type Year     = { id: string; name: string; isCurrent: boolean };
type Semester = { id: string; name: string; isCurrent: boolean; academicYearId: string };
type Dept     = { id: string; name: string; code: string };
type Section  = { id: string; name: string; departmentId: string | null };

export default function SchedulerPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const instituteId = user?.role?.name === 'ADMIN' ? undefined : (user?.instituteId ?? undefined);

  const [name,       setName]       = useState('');
  const [yearId,     setYearId]     = useState('');
  const [semId,      setSemId]      = useState('');
  const [deptId,     setDeptId]     = useState('');
  const [sectionId,  setSectionId]  = useState('');
  const [useGenetic, setUseGenetic] = useState(true);
  const [resultId,   setResultId]   = useState('');
  const [submitErr,  setSubmitErr]  = useState('');

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
      (await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) })).data.data as Dept[],
    staleTime: 0,
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', deptId || 'all', instituteId || 'all'],
    queryFn: async () =>
      (await sectionsApi.list({
        limit: 100,
        ...(deptId ? { departmentId: deptId } : {}),
        ...(instituteId ? { instituteId } : {}),
      })).data.data as Section[],
    staleTime: 0,
  });

  useEffect(() => {
    if (!years?.length) return;
    const cur = years.find((y) => y.isCurrent) ?? years[0];
    setYearId(cur.id);
  }, [years]);

  const filteredSemesters = (semesters ?? []).filter(
    (s) => !yearId || s.academicYearId === yearId
  );

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
      toast.success(`Generated! Optimization Score ${tt.score ?? 0} — view on Timetable page`);
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
    'h-11 w-full rounded-xl border border-border bg-white/60 px-3 text-sm font-semibold dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-primary/40';

  const scopeLabel = sectionId
    ? `section ${(sections ?? []).find((s) => s.id === sectionId)?.name ?? ''}`
    : deptId
    ? `${(departments ?? []).find((d) => d.id === deptId)?.code ?? ''} dept`
    : 'all sections';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <GlassCard className="p-6 md:p-8 bg-gradient-to-r from-primary/15 via-primary-light/10 to-amber-500/10 border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary text-white shadow-md">
                <Cpu size={22} />
              </div>
              <InstituteBadge code={user?.institute?.code || 'CHARUSAT'} size="md" />
            </div>
            <h1 className="font-display font-extrabold text-2xl md:text-3xl text-foreground tracking-tight">
              AI Timetable Scheduler Engine
            </h1>
            <p className="text-sm text-muted">
              Constraint satisfaction algorithm with greedy backtracking and genetic polish. Synthesizes conflict-free timetables for CHARUSAT divisions.
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form Panel */}
        <GlassCard title="Configure Scheduler" subtitle="Set scope and parameters" headerIcon={<Zap size={18} />}>
          <form className="space-y-4 pt-1" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="tt-name" className="font-semibold text-xs text-foreground">
                Timetable Title (optional)
              </Label>
              <Input
                id="tt-name"
                placeholder="e.g. CSE Odd Semester 2025-26"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tt-year" className="font-semibold text-xs text-foreground">Academic Year</Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="tt-sem" className="font-semibold text-xs text-foreground">Semester</Label>
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

            <div className="space-y-2 pt-1">
              <Label className="font-semibold text-xs text-foreground">Scope Configuration</Label>
              <div className="rounded-2xl border border-border/50 bg-white/40 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted">Department</p>
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
                  <p className="text-xs font-semibold text-muted">
                    Division / Section
                    {!deptId && <span className="ml-1 opacity-60 font-normal">(select department to filter)</span>}
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
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer pt-1 text-foreground">
              <input
                type="checkbox"
                checked={useGenetic}
                onChange={(e) => setUseGenetic(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <span>Enable Genetic Algorithm Optimization Polish</span>
            </label>

            {submitErr && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {submitErr}
              </p>
            )}

            <Button
              type="submit"
              disabled={generate.isPending}
              className="w-full h-12 rounded-xl font-extrabold text-sm bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/30 hover:opacity-95 gap-2"
            >
              <Sparkles size={18} />
              {generate.isPending ? 'Synthesizing Timetable…' : `Synthesize Timetable — ${scopeLabel}`}
            </Button>
          </form>
        </GlassCard>

        {/* Results Panel */}
        <GlassCard title="Synthesis Results & Metrics" subtitle="Algorithm evaluation output" headerIcon={<Layers size={18} />}>
          {status ? (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant={status.status === 'PUBLISHED' ? 'success' : 'default'} className="font-bold">
                  {status.status}
                </Badge>
                <Badge variant="secondary" className="font-mono font-bold">
                  Entries: {status._count?.entries ?? 0}
                </Badge>
                <Badge variant={status._count?.conflicts > 0 ? 'warning' : 'success'} className="font-mono font-bold">
                  Conflicts: {status._count?.conflicts ?? 0}
                </Badge>
                {status.score != null && (
                  <Badge variant="success" className="font-mono font-bold">
                    Score: {status.score}
                  </Badge>
                )}
              </div>

              {(status.metadata?.unassigned?.length ?? 0) > 0 && (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-300">
                  <strong className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle size={15} /> {status.metadata.unassigned.length} unscheduled hours
                  </strong>
                  <div className="max-h-24 overflow-y-auto space-y-1 font-mono">
                    {status.metadata.unassigned.map((u: { subjectCode: string; isLab: boolean }, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{u.subjectCode}</span>
                        <span className="opacity-80">{u.isLab ? 'Lab' : 'Theory'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold gap-1.5"
                  onClick={async () => {
                    await schedulerApi.optimize(resultId);
                    qc.invalidateQueries({ queryKey: ['scheduler-status', resultId] });
                    toast.success('Optimization started');
                  }}
                >
                  <RefreshCw size={14} /> Re-Optimize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold gap-1.5"
                  onClick={async () => {
                    const res = await schedulerApi.resolveConflicts(resultId);
                    toast.success(`Resolved ${res.data.data.resolved} conflicts`);
                    qc.invalidateQueries({ queryKey: ['conflicts', resultId] });
                  }}
                >
                  <ShieldCheck size={14} /> Resolve Conflicts
                </Button>
                <Link to="/timetable">
                  <Button variant="default" size="sm" className="rounded-xl font-bold gap-1.5 bg-gradient-to-r from-primary to-primary-light">
                    Open Timetable <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto pt-2">
                {(conflicts ?? status.conflicts ?? []).map(
                  (c: { id: string; type: string; severity: string; description: string }) => (
                    <div key={c.id} className="rounded-xl border border-border/50 p-3 text-xs bg-white/40 dark:bg-slate-900/40">
                      <div className="mb-1 flex gap-2 items-center">
                        <Badge variant={c.severity === 'CRITICAL' ? 'danger' : 'warning'} className="font-bold">
                          {c.severity}
                        </Badge>
                        <span className="font-bold text-foreground">{c.type}</span>
                      </div>
                      <p className="text-muted font-medium">{c.description}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted space-y-3">
              <Cpu size={40} className="opacity-40 text-primary dark:text-cyan-accent" />
              <p className="font-semibold text-sm">Configure options and click Synthesize Timetable</p>
              <p className="text-xs max-w-xs opacity-70">
                You can generate for a single division or across all departments in {user?.institute?.code || 'CHARUSAT'}.
              </p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
