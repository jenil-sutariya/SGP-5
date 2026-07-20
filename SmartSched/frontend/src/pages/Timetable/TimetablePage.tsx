import { useMemo, useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  Printer,
  RefreshCw,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  Coffee,
  User,
  Building2,
  FlaskConical,
  X,
  Layers,
} from 'lucide-react';
import { academicApi, timetableApi } from '@/api';
import { Button, Badge, Skeleton } from '@/components/ui';
import { GlassCard } from '@/components/common/GlassCard';
import { cn } from '@/utils/cn';
import { useInstituteScope } from '../common/ResourcePage';

type Entry = {
  id: string;
  dayId: string;
  timeSlotId: string;
  isLab: boolean;
  day: { id: string; name: string; order: number; shortName: string };
  timeSlot: { id: string; name: string; order: number; startTime: string; endTime: string; isLunchBreak: boolean };
  courseOffering: { subject: { code: string; name: string; type: string } };
  faculty: { user: { firstName: string; lastName: string } };
  room?: { code: string; name?: string } | null;
  laboratory?: { code: string; name?: string } | null;
  section?: { id: string; code: string; name: string } | null;
  practicalBatch?: { id: string; name: string; code: string } | null;
};

function formatSubjectCode(code: string, compact: boolean): string {
  if (!compact) return code;
  return code.replace(/^(CSPIT|DEPSTAR|RPCP|CMPICA|IIM|PDPIAS|CPICP)-(CE|IT|CSE|EC|EE|ME|CL|AIML|DS|CY)-/i, '');
}

function formatFacultyName(firstName?: string, lastName?: string, compact?: boolean): string {
  if (!firstName) return 'Unassigned';
  if (!compact) return `${firstName} ${lastName ?? ''}`;
  if (!lastName) return firstName;
  return `${firstName} ${lastName.charAt(0)}.`;
}

// Custom batch badge styling
function getBatchStyle(batchName?: string) {
  const name = batchName?.toUpperCase() ?? '';
  if (name.includes('A') || name.endsWith('A')) {
    return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40';
  }
  if (name.includes('B') || name.endsWith('B')) {
    return 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40';
  }
  if (name.includes('C') || name.endsWith('C')) {
    return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40';
  }
  return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40';
}

function formatBatchLabel(batchName?: string): string {
  if (!batchName) return 'LAB';
  const parts = batchName.split('-');
  const lastPart = parts[parts.length - 1];
  if (lastPart && lastPart.length <= 2) {
    return `Batch ${lastPart}`;
  }
  return batchName;
}

// Memoized Entry Card for maximum rendering performance (60 FPS)
const EntryCard = memo(function EntryCard({
  entry,
  onDragStart,
  compact = false,
}: {
  entry: Entry;
  onDragStart: (e: React.DragEvent, entryId: string) => void;
  compact?: boolean;
}) {
  const subjectCode = formatSubjectCode(entry.courseOffering?.subject?.code ?? '', compact);
  const subjectName = entry.courseOffering?.subject?.name;
  const facultyName = formatFacultyName(entry.faculty?.user?.firstName, entry.faculty?.user?.lastName, compact);
  const roomCode = entry.laboratory?.code ?? entry.laboratory?.name ?? entry.room?.code ?? entry.room?.name ?? 'TBA';
  const batchName = entry.practicalBatch?.name;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, entry.id)}
      title={`${entry.courseOffering?.subject?.code ?? ''} - ${subjectName || ''}\nFaculty: ${entry.faculty?.user?.firstName ?? ''} ${entry.faculty?.user?.lastName ?? ''}\nRoom: ${roomCode}${batchName ? `\nBatch: ${batchName}` : ''}`}
      className={cn(
        'group cursor-grab active:cursor-grabbing rounded-xl border transition-all duration-200 hover:scale-[1.02] transform-gpu min-w-0 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md',
        compact ? 'p-1 text-[9px] leading-tight h-full max-h-full' : 'p-3 text-xs space-y-1.5 shadow-sm rounded-2xl',
        entry.isLab
          ? 'bg-gradient-to-br from-amber-500/15 via-amber-600/10 to-amber-950/20 text-amber-950 border-amber-400/50 dark:text-amber-100 dark:border-amber-500/40'
          : 'bg-gradient-to-br from-primary/10 via-primary/5 to-cyan-500/10 text-primary border-primary/25 dark:text-cyan-accent dark:border-cyan-accent/30'
      )}
    >
      {/* Subject Header */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className={cn('font-extrabold truncate tracking-tight text-foreground', compact ? 'text-[9.5px]' : 'text-xs')}>
          {subjectCode}
        </span>
        {entry.isLab && (
          <span className={cn('shrink-0 font-extrabold rounded border whitespace-nowrap tracking-wider', getBatchStyle(batchName), compact ? 'px-1 py-0.2 text-[8px]' : 'px-2 py-0.5 text-[10px]')}>
            {formatBatchLabel(batchName)}
          </span>
        )}
      </div>

      {!compact && subjectName && (
        <p className="text-[11px] font-medium text-muted line-clamp-1 leading-snug">
          {subjectName}
        </p>
      )}

      {/* Professor */}
      <p className={cn('font-semibold opacity-90 flex items-center gap-1 truncate text-foreground/90', compact ? 'text-[8.5px]' : 'text-xs mt-1')}>
        <User size={compact ? 9 : 12} className="shrink-0 text-primary dark:text-cyan-accent" />
        <span className="truncate">{facultyName}</span>
      </p>

      {/* Footer Info */}
      <div className={cn('opacity-85 font-mono font-medium flex items-center justify-between truncate border-t border-border/30', compact ? 'text-[8px] pt-0.5 mt-0.5' : 'text-[11px] pt-1.5 mt-2')}>
        <span className="truncate flex items-center gap-1">
          {entry.isLab ? <FlaskConical size={compact ? 8 : 11} className="shrink-0 text-amber-500" /> : <Building2 size={compact ? 8 : 11} className="shrink-0 text-primary" />}
          <span>{roomCode}</span>
        </span>
        {!compact && entry.section?.code && (
          <span className="ml-1 shrink-0 font-bold bg-primary/10 text-primary dark:text-cyan-accent px-1.5 py-0.5 rounded text-[10px]">
            {entry.section.code}
          </span>
        )}
      </div>
    </div>
  );
});

export default function TimetablePage() {
  const qc = useQueryClient();
  const { instituteId } = useInstituteScope();
  const [selectedId, setSelectedId] = useState<string>(
    () => sessionStorage.getItem('selected-timetable-id') ?? ''
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [isFitWindow, setIsFitWindow] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUnassignedDrawer, setShowUnassignedDrawer] = useState<boolean>(false);

  const { data: timetables, refetch: refetchList } = useQuery({
    queryKey: ['timetables', instituteId ?? 'all'],
    queryFn: async () => (await timetableApi.list({ limit: 50, sortBy: 'createdAt', sortOrder: 'desc', ...(instituteId ? { instituteId } : {}) })).data.data,
    staleTime: 60000,
  });

  const activeId = selectedId || timetables?.[0]?.id;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedSectionId('');
    sessionStorage.setItem('selected-timetable-id', id);
  };

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', activeId],
    enabled: !!activeId,
    staleTime: 30000,
    queryFn: async () => {
      try {
        return (await timetableApi.get(activeId)).data.data;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          sessionStorage.removeItem('selected-timetable-id');
          setSelectedId('');
        }
        throw error;
      }
    },
    retry: false,
  });

  const { data: days = [] } = useQuery({
    queryKey: ['days', instituteId ?? 'all'],
    queryFn: async () => (await academicApi.days({ ...(instituteId ? { instituteId } : {}) })).data.data,
    staleTime: 300000,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['slots', instituteId ?? 'all'],
    queryFn: async () => (await academicApi.timeSlots({ ...(instituteId ? { instituteId } : {}) })).data.data,
    staleTime: 300000,
  });

  const workingDays = useMemo(() => days.filter((d: { isWorking: boolean }) => d.isWorking), [days]);
  const teachingSlots = useMemo(() => slots.filter((s: { isLunchBreak: boolean }) => !s.isLunchBreak || true), [slots]);

  const uniqueSections = useMemo(() => {
    const sectionsMap = new Map<string, { id: string; code: string; name: string }>();
    for (const e of (timetable?.entries ?? []) as Entry[]) {
      if (e.section) {
        sectionsMap.set(e.section.id, {
          id: e.section.id,
          code: e.section.code,
          name: e.section.name || e.section.code,
        });
      }
    }
    return Array.from(sectionsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [timetable]);

  const activeSectionId = useMemo(() => {
    if (selectedSectionId === 'all') return '';
    if (selectedSectionId) return selectedSectionId;
    return uniqueSections[0]?.id ?? '';
  }, [selectedSectionId, uniqueSections]);

  const entryMap = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const entries = (timetable?.entries ?? []) as Entry[];
    let filtered = activeSectionId
      ? entries.filter((e) => e.section?.id === activeSectionId)
      : entries;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.courseOffering?.subject?.code?.toLowerCase().includes(q) ||
          e.courseOffering?.subject?.name?.toLowerCase().includes(q) ||
          e.faculty?.user?.firstName?.toLowerCase().includes(q) ||
          e.faculty?.user?.lastName?.toLowerCase().includes(q) ||
          e.room?.code?.toLowerCase().includes(q) ||
          e.laboratory?.code?.toLowerCase().includes(q)
      );
    }

    for (const e of filtered) {
      const key = `${e.dayId}|${e.timeSlotId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [timetable, activeSectionId, searchQuery]);

  const unassignedSessions = useMemo(() => {
    const meta = timetable?.metadata as any;
    if (!meta || !Array.isArray(meta.unassigned)) return [];

    const list = meta.unassigned;
    return activeSectionId
      ? list.filter((u: any) => u.sectionId === activeSectionId)
      : list;
  }, [timetable, activeSectionId]);

  const moveMutation = useMutation({
    mutationFn: ({ entryId, dayId, timeSlotId }: { entryId: string; dayId: string; timeSlotId: string }) =>
      timetableApi.updateEntry(entryId, { dayId, timeSlotId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable', activeId] });
      toast.success('Entry moved');
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Move failed');
    },
  });

  const onDragStart = (e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('entryId', entryId);
  };

  const onDrop = (e: React.DragEvent, dayId: string, timeSlotId: string, isLunch: boolean) => {
    e.preventDefault();
    if (isLunch) return;
    const entryId = e.dataTransfer.getData('entryId');
    if (entryId) moveMutation.mutate({ entryId, dayId, timeSlotId });
  };

  const download = async (type: 'excel' | 'pdf') => {
    if (!activeId) return;
    const res = type === 'excel' ? await timetableApi.exportExcel(activeId) : await timetableApi.exportPdf(activeId);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable.${type === 'excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeSectionName = uniqueSections.find((s) => s.id === activeSectionId)?.name ?? 'All Divisions';

  // Highlight current working day
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  return (
    <div className={cn('space-y-4', isFitWindow && 'h-[calc(100vh-5.5rem)] flex flex-col space-y-3 overflow-hidden')}>
      {/* Futuristic Control Toolbar Header */}
      <GlassCard className={cn('p-4 border border-white/20 dark:border-white/10 shadow-xl', isFitWindow && 'p-2.5 px-4 shrink-0')}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Title & Scope Badges */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-primary to-cyan-400 text-white shadow-md shadow-primary/30">
              <CalendarDays size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">
                  Academic Timetable
                </h2>
                <Badge variant="default" className="text-[10px] font-bold bg-gold/15 text-gold border border-gold/30 px-2 py-0.5 rounded-full">
                  Semester 2026
                </Badge>
              </div>
              <p className="text-xs text-muted font-medium">Interactive grid view filtered by division & batch</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="no-print flex flex-wrap gap-2 items-center">
            {/* Search filter input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Search subject, faculty, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 rounded-xl border border-border/60 bg-white/60 dark:bg-slate-900/60 pl-8 pr-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 w-44 sm:w-52 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-muted hover:text-foreground">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Timetable Selector */}
            <select
              className="h-8.5 rounded-xl border border-border bg-white/70 px-2.5 text-xs font-semibold dark:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              value={activeId ?? ''}
              onChange={(e) => handleSelect(e.target.value)}
            >
              {(timetables ?? []).length === 0 && <option value="">No timetables available</option>}
              {(timetables ?? []).map((t: { id: string; name: string; status: string }) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>

            {/* Division Filter */}
            {uniqueSections.length > 0 && (
              <select
                className="h-8.5 rounded-xl border border-primary/40 bg-primary/10 px-2.5 text-xs font-bold text-primary dark:text-cyan-accent dark:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                value={selectedSectionId || (uniqueSections[0] ? '' : 'all')}
                onChange={(e) => setSelectedSectionId(e.target.value)}
              >
                {uniqueSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Division: {sec.name} ({sec.code})
                  </option>
                ))}
                <option value="all">All Divisions (Combined)</option>
              </select>
            )}

            {/* View Mode Toggle */}
            <Button
              variant={isFitWindow ? 'default' : 'outline'}
              className="rounded-xl h-8.5 px-3 gap-1.5 font-bold text-xs shadow-xs"
              onClick={() => setIsFitWindow((v) => !v)}
              title={isFitWindow ? 'Switch to full scroll view' : 'Fit timetable into single screen window without scrolling'}
            >
              {isFitWindow ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {isFitWindow ? 'One Window' : 'Full Scroll'}
            </Button>

            {/* Actions */}
            <Button
              variant="outline"
              className="rounded-xl h-8.5 px-2.5 gap-1.5 font-semibold text-xs"
              onClick={() => { refetchList(); qc.invalidateQueries({ queryKey: ['timetable', activeId] }); }}
            >
              <RefreshCw size={13} />
            </Button>
            <Button variant="outline" className="rounded-xl h-8.5 px-2.5 gap-1.5 font-semibold text-xs" onClick={() => download('excel')}>
              <Download size={13} /> Excel
            </Button>
            <Button variant="outline" className="rounded-xl h-8.5 px-2.5 gap-1.5 font-semibold text-xs" onClick={() => download('pdf')}>
              <Download size={13} /> PDF
            </Button>
            <Button variant="outline" className="rounded-xl h-8.5 px-2.5 gap-1.5 font-semibold text-xs" onClick={() => window.print()}>
              <Printer size={13} /> Print
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Grid Viewport Container */}
      {isLoading || !activeId ? (
        <Skeleton className="h-[500px] rounded-3xl" />
      ) : (
        <GlassCard className={cn('print-area border border-white/20 dark:border-white/10 shadow-2xl', isFitWindow ? 'flex-1 min-h-0 flex flex-col p-3 overflow-hidden' : 'p-4 overflow-x-auto')}>
          {/* Sub Header Metrics & Badges */}
          <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2', isFitWindow ? 'mb-1.5 shrink-0' : 'mb-4 pb-3')}>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-base text-foreground truncate">{timetable?.name}</h3>
              <Badge variant={timetable?.status === 'PUBLISHED' ? 'success' : 'default'} className="font-bold text-xs">
                {timetable?.status}
              </Badge>
              {timetable?.score != null && (
                <Badge variant="secondary" className="font-mono text-xs font-semibold hidden sm:inline-flex">
                  Score: {timetable.score}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unassignedSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-amber-600 border-amber-400/50 hover:bg-amber-500/10 font-bold gap-1 rounded-lg animate-pulse"
                  onClick={() => setShowUnassignedDrawer((v) => !v)}
                >
                  <AlertTriangle size={13} /> {unassignedSessions.length} Unscheduled
                </Button>
              )}
              <Badge variant="default" className="text-xs font-bold px-2.5 py-0.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-full shadow-xs">
                Div: {activeSectionName}
              </Badge>
            </div>
          </div>

          {/* Redesigned Grid Table */}
          {isFitWindow ? (
            <div className="flex-1 min-h-0 flex flex-col border border-border/40 rounded-2xl overflow-hidden bg-slate-950/20 shadow-inner">
              {/* Header Row */}
              <div className="flex w-full bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white border-b border-border/60 shrink-0">
                <div className="w-16 shrink-0 p-1.5 text-[9.5px] font-extrabold uppercase tracking-wider text-center border-r border-white/10 flex items-center justify-center text-muted">
                  Time
                </div>
                {workingDays.map((d: { id: string; shortName: string; name?: string }) => {
                  const isToday = d.shortName.toUpperCase() === todayDayName;
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        'flex-1 min-w-0 p-1.5 text-center font-bold text-xs font-display border-r border-white/10 last:border-r-0 truncate flex items-center justify-center gap-1.5',
                        isToday && 'bg-primary/20 text-cyan-accent font-extrabold'
                      )}
                    >
                      <span>{d.name || d.shortName}</span>
                      {isToday && <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent animate-ping" />}
                    </div>
                  );
                })}
              </div>

              {/* Grid Body with Strict Equal Rows */}
              <div
                className="flex-1 min-h-0 grid divide-y divide-border/40"
                style={{ gridTemplateRows: `repeat(${teachingSlots.length}, minmax(0, 1fr))` }}
              >
                {teachingSlots.map((slot: { id: string; name: string; startTime: string; endTime: string; isLunchBreak: boolean }) => (
                  <div
                    key={slot.id}
                    className={cn(
                      'flex w-full min-h-0 overflow-hidden transition-colors',
                      slot.isLunchBreak ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 dark:from-amber-950/30 dark:to-amber-950/30' : ''
                    )}
                  >
                    {/* Time Column */}
                    <div className="w-16 shrink-0 bg-slate-900/60 dark:bg-slate-950/80 p-0.5 text-[9px] font-mono font-bold flex flex-col justify-center items-center text-center border-r border-border/40 leading-tight">
                      <div className="text-foreground font-bold">{slot.startTime}</div>
                      <div className="text-muted text-[8px]">{slot.endTime}</div>
                      {slot.isLunchBreak && (
                        <div className="text-amber-600 dark:text-amber-400 font-bold text-[8px] flex items-center gap-0.5 mt-0.5">
                          <Coffee size={8} /> Lunch
                        </div>
                      )}
                    </div>

                    {/* Day Columns */}
                    {workingDays.map((day: { id: string }) => {
                      const entriesList = entryMap.get(`${day.id}|${slot.id}`) ?? [];
                      return (
                        <div
                          key={`${day.id}-${slot.id}`}
                          className="flex-1 min-w-0 border-r border-border/40 last:border-r-0 p-0.5 overflow-hidden flex flex-col justify-center relative group"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDrop(e, day.id, slot.id, slot.isLunchBreak)}
                        >
                          {entriesList.length > 0 ? (
                            <div
                              className={cn(
                                'w-full h-full max-h-full overflow-hidden',
                                entriesList.length >= 3
                                  ? 'grid grid-cols-3 gap-0.5 items-center'
                                  : entriesList.length === 2
                                  ? 'grid grid-cols-2 gap-0.5 items-center'
                                  : 'flex flex-col justify-center'
                              )}
                            >
                              {entriesList.map((entry) => (
                                <EntryCard key={entry.id} entry={entry} onDragStart={onDragStart} compact={true} />
                              ))}
                            </div>
                          ) : (
                            <div className="w-full h-full rounded-lg border border-dashed border-border/20 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center">
                              {slot.isLunchBreak && (
                                <span className="text-[8.5px] font-bold text-amber-600/60 dark:text-amber-400/60 font-mono">BREAK</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Spacious Scrollable Table View */
            <div className="overflow-x-auto rounded-2xl border border-border/40">
              <table className="w-full min-w-[1300px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="sticky left-0 bg-slate-900 p-3 text-left font-bold border-b z-10 w-28 text-xs text-muted uppercase tracking-wider">
                      Time
                    </th>
                    {workingDays.map((d: { id: string; shortName: string; name?: string }) => (
                      <th key={d.id} className="p-3 text-center font-bold text-sm border-b min-w-[230px] font-display">
                        {d.name || d.shortName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachingSlots.map((slot: { id: string; name: string; startTime: string; endTime: string; isLunchBreak: boolean }) => (
                    <tr key={slot.id} className={slot.isLunchBreak ? 'bg-amber-500/10 dark:bg-amber-950/20' : ''}>
                      <td className="sticky left-0 whitespace-nowrap bg-slate-900 p-3 text-xs font-bold border-r border-b z-10 font-mono text-white">
                        <div>{slot.startTime} - {slot.endTime}</div>
                        {slot.isLunchBreak && <div className="text-amber-400 font-bold mt-0.5 flex items-center gap-1"><Coffee size={12} /> Lunch Break</div>}
                      </td>
                      {workingDays.map((day: { id: string }) => {
                        const entriesList = entryMap.get(`${day.id}|${slot.id}`) ?? [];
                        return (
                          <td
                            key={`${day.id}-${slot.id}`}
                            className="border border-border/40 p-2 align-top min-w-[230px]"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => onDrop(e, day.id, slot.id, slot.isLunchBreak)}
                          >
                            {entriesList.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {entriesList.map((entry) => (
                                  <EntryCard key={entry.id} entry={entry} onDragStart={onDragStart} compact={false} />
                                ))}
                              </div>
                            ) : (
                              <div className="h-20 rounded-2xl border border-dashed border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center text-xs text-muted font-medium">
                                Drag session here
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Remaining Unassigned Sessions Drawer Overlay */}
          {unassignedSessions.length > 0 && showUnassignedDrawer && (
            <div className="mt-4 border-t border-border/60 pt-3 shrink-0 max-h-48 overflow-y-auto bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-amber-500/30 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-display font-bold text-amber-400 flex items-center gap-2 text-xs">
                  <AlertTriangle size={16} /> Unscheduled Sessions Queue ({unassignedSessions.length}):
                </h4>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-white hover:bg-white/10" onClick={() => setShowUnassignedDrawer(false)}>
                  <X size={14} /> Close Queue
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {unassignedSessions.map((u: any, index: number) => (
                  <div
                    key={index}
                    className="flex flex-col justify-between p-3 rounded-xl border border-amber-400/40 bg-amber-500/10 text-xs shadow-xs"
                  >
                    <div>
                      <p className="font-bold text-xs text-amber-200 truncate flex items-center justify-between">
                        <span>{u.subjectCode} - {u.subjectName || 'Subject'}</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-amber-500/30 rounded text-amber-300">
                          {u.isLab ? 'LAB' : 'LECTURE'}
                        </span>
                      </p>
                      <p className="text-amber-100/70 text-[11px] font-semibold mt-1 truncate">
                        Professor: {u.facultyName || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassignedSessions.length === 0 && activeSectionId && !isFitWindow && (
            <div className="mt-4 border-t border-border/60 pt-3">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} /> All subject hours for this division are 100% scheduled!
              </p>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
