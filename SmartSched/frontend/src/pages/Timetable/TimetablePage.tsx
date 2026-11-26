import { SessionEditor } from './SessionEditor';
import { useMemo, useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  Trash2,
  Printer,
  RefreshCw,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Search,
  Coffee,
  User,
  Building2,
  FlaskConical,
  X,
  Lock,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';
import { academicApi, timetableApi } from '@/api';
import { Button, Badge, Select, Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { useInstituteScope } from '../common/ResourcePage';

type Entry = {
  sessionId: string;
  isLocked: boolean;
  cancellationReason?: string | null;
  date?: string;
  id: string;
  dayId: string;
  timeSlotId: string;
  isLab: boolean;
  day: { id: string; name: string; order: number; shortName: string };
  timeSlot: {
    id: string;
    name: string;
    order: number;
    startTime: string;
    endTime: string;
    isLunchBreak: boolean;
  };
  courseOffering: { subject: { code: string; name: string; type: string } };
  faculty: { user: { firstName: string; lastName: string } };
  room?: { code: string; name?: string } | null;
  laboratory?: { code: string; name?: string } | null;
  section?: { id: string; code: string; name: string } | null;
  practicalBatch?: { id: string; name: string; code: string } | null;
};

function formatSubjectCode(code: string, compact: boolean): string {
  if (!compact) return code;
  return code.replace(
    /^(CSPIT|DEPSTAR|RPCP|CMPICA|IIM|PDPIAS|CPICP)-(CE|IT|CSE|EC|EE|ME|CL|AIML|DS|CY)-/i,
    ''
  );
}

function formatFacultyName(firstName?: string, lastName?: string, compact?: boolean): string {
  if (!firstName) return 'Unassigned';
  if (!compact) return `${firstName} ${lastName ?? ''}`.trim();
  if (!lastName) return firstName;
  return `${firstName} ${lastName.charAt(0)}.`;
}

function getBatchStyle(batchName?: string) {
  const name = batchName?.toUpperCase() ?? '';
  if (name.includes('A') || name.endsWith('A')) {
    return 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/35';
  }
  if (name.includes('B') || name.endsWith('B')) {
    return 'bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/35';
  }
  if (name.includes('C') || name.endsWith('C')) {
    return 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/35';
  }
  return 'bg-purple-500/15 text-purple-900 dark:text-purple-200 border-purple-500/35';
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

const EntryCard = memo(function EntryCard({
  entry,
  onDragStart,
  compact = false,
  editable = false,
  onEdit,
}: {
  entry: Entry;
  onDragStart: (e: React.DragEvent, entryId: string) => void;
  compact?: boolean;
  editable?: boolean;
  onEdit?: (sessionId: string) => void;
}) {
  const subjectCode = formatSubjectCode(entry.courseOffering?.subject?.code ?? '', compact);
  const subjectName = entry.courseOffering?.subject?.name;
  const facultyName = formatFacultyName(
    entry.faculty?.user?.firstName,
    entry.faculty?.user?.lastName,
    compact
  );
  const roomCode =
    entry.laboratory?.code ?? entry.laboratory?.name ?? entry.room?.code ?? entry.room?.name ?? 'TBA';
  const batchName = entry.practicalBatch?.name;
  const canDrag = editable && !entry.isLocked && !entry.cancellationReason;

  return (
    <article
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, entry.id)}
      title={`${entry.courseOffering?.subject?.code ?? ''} - ${subjectName || ''}\nFaculty: ${
        entry.faculty?.user?.firstName ?? ''
      } ${entry.faculty?.user?.lastName ?? ''}\nRoom: ${roomCode}${
        batchName ? `\nBatch: ${batchName}` : ''
      }`}
      className={cn(
        'group rounded-xl border border-l-4 transition-colors duration-150 min-w-0 flex flex-col justify-between overflow-hidden',
        canDrag && 'cursor-grab active:cursor-grabbing',
        compact ? 'p-1.5 text-[10px] leading-tight h-full' : 'p-3 text-xs space-y-1.5 shadow-2xs',
        entry.cancellationReason
          ? 'border-red-300 border-l-red-600 bg-red-50/90 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100'
          : entry.isLab
            ? 'border-amber-200/90 border-l-amber-600 bg-amber-50/85 text-slate-900 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:border-amber-800/60 dark:border-l-amber-500 dark:text-slate-100 dark:hover:bg-amber-950/45'
            : 'border-blue-200/90 border-l-primary bg-blue-50/80 text-slate-900 hover:bg-blue-100/60 dark:bg-blue-950/35 dark:border-blue-800/60 dark:border-l-blue-400 dark:text-slate-100 dark:hover:bg-blue-950/50'
      )}
    >
      {entry.cancellationReason && (
        <p className="text-red-700 dark:text-red-300 font-bold text-[10px] truncate">
          Cancelled · {entry.cancellationReason}
        </p>
      )}

      {/* Subject Header */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span
          className={cn(
            'font-display font-bold truncate tracking-tight text-slate-900 dark:text-slate-50',
            compact ? 'text-[10px]' : 'text-xs'
          )}
        >
          {subjectCode}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {entry.isLab && (
            <span
              className={cn(
                'font-bold rounded border whitespace-nowrap',
                getBatchStyle(batchName),
                compact ? 'px-1 py-0 text-[8.5px]' : 'px-1.5 py-0.5 text-[10px]'
              )}
            >
              {formatBatchLabel(batchName)}
            </span>
          )}
          {editable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(entry.sessionId);
              }}
              aria-label={entry.isLocked ? 'Session locked, open editor' : 'Edit session'}
              title={entry.isLocked ? 'Locked · Click to unlock or inspect' : 'Edit session'}
              className="no-print inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9.5px] font-semibold bg-white/80 dark:bg-slate-800/90 text-primary dark:text-cyan-accent border border-border hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
            >
              {entry.isLocked ? (
                <Lock size={9} aria-hidden="true" />
              ) : (
                <Pencil size={9} aria-hidden="true" />
              )}
              {!compact && <span>{entry.isLocked ? 'Locked' : 'Edit'}</span>}
            </button>
          )}
        </div>
      </div>

      {!compact && subjectName && (
        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-1 leading-snug">
          {subjectName}
        </p>
      )}

      {/* Professor */}
      <p
        className={cn(
          'font-medium flex items-center gap-1 truncate text-slate-700 dark:text-slate-200',
          compact ? 'text-[9px]' : 'text-xs mt-0.5'
        )}
      >
        <User
          size={compact ? 9 : 12}
          aria-hidden="true"
          className="shrink-0 text-primary dark:text-cyan-accent"
        />
        <span className="truncate">{facultyName}</span>
      </p>

      {/* Footer Info */}
      <div
        className={cn(
          'font-mono font-semibold flex items-center justify-between truncate border-t border-slate-300/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 tabular-nums',
          compact ? 'text-[8.5px] pt-0.5 mt-0.5' : 'text-[11px] pt-1.5 mt-1'
        )}
      >
        <span className="truncate flex items-center gap-1">
          {entry.isLab ? (
            <FlaskConical
              size={compact ? 9 : 11}
              aria-hidden="true"
              className="shrink-0 text-amber-700 dark:text-amber-400"
            />
          ) : (
            <Building2
              size={compact ? 9 : 11}
              aria-hidden="true"
              className="shrink-0 text-primary dark:text-cyan-accent"
            />
          )}
          <span className="truncate">{roomCode}</span>
        </span>
        {!compact && entry.section?.code && (
          <span className="ml-1 shrink-0 font-bold bg-white/80 dark:bg-slate-800 text-primary dark:text-cyan-accent px-1.5 py-0.5 rounded text-[10px] border border-border/60">
            {entry.section.code}
          </span>
        )}
      </div>
    </article>
  );
});

export default function TimetablePage() {
  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { instituteId } = useInstituteScope();
  const [selectedId, setSelectedId] = useState<string>(
    () => sessionStorage.getItem('selected-timetable-id') ?? ''
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [isFitWindow, setIsFitWindow] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [week, setWeek] = useState('');
  const [template, setTemplate] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const isStudent = user?.role?.name === 'STUDENT';
  const isManager = ['ADMIN', 'INSTITUTE_ADMIN', 'SCHEDULER', 'DEPARTMENT_HEAD'].includes(
    user?.role?.name || ''
  );
  const [showUnassignedDrawer, setShowUnassignedDrawer] = useState<boolean>(false);

  const { data: timetables, isLoading: isListLoading, refetch: refetchList } = useQuery({
    queryKey: ['timetables', instituteId ?? 'all', user?.id],
    queryFn: async () =>
      (
        await timetableApi.list({
          limit: 50,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          ...(instituteId ? { instituteId } : {}),
        })
      ).data.data,
    staleTime: 60000,
  });

  const activeId = selectedId || timetables?.[0]?.id;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setWeek('');
    setSelectedSectionId('');
    sessionStorage.setItem('selected-timetable-id', id);
  };

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', activeId, user?.id],
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

  const canManage =
    isManager &&
    (user?.role?.name !== 'DEPARTMENT_HEAD' || timetable?.departmentId === user.departmentId);
  const canEdit = canManage && ['DRAFT', 'GENERATED'].includes(timetable?.status) && template;

  const { data: occurrences, isFetching: loadingWeek, isError: weekError } = useQuery({
    queryKey: ['occurrences', activeId, week, user?.id],
    enabled: !!activeId && (!template || isStudent),
    queryFn: async () => (await timetableApi.occurrences(activeId, week || undefined)).data.data,
    staleTime: 0,
    refetchInterval: isStudent ? 15000 : false,
    retry: false,
  });

  const visibleEntries =
    weekError && (!template || isStudent)
      ? []
      : template && !isStudent
        ? timetable?.entries
        : occurrences?.entries;

  const calendarInstituteId = timetable?.instituteId ?? instituteId;

  const { data: days = [] } = useQuery({
    queryKey: ['days', calendarInstituteId ?? 'all'],
    queryFn: async () =>
      (
        await academicApi.days({
          ...(calendarInstituteId ? { instituteId: calendarInstituteId } : {}),
        })
      ).data.data,
    staleTime: 300000,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['slots', calendarInstituteId ?? 'all'],
    queryFn: async () =>
      (
        await academicApi.timeSlots({
          ...(calendarInstituteId ? { instituteId: calendarInstituteId } : {}),
        })
      ).data.data,
    staleTime: 300000,
  });

  const workingDays = useMemo(() => days.filter((d: { isWorking: boolean }) => d.isWorking), [days]);
  const teachingSlots = useMemo(
    () => slots.filter((s: { isLunchBreak: boolean }) => !s.isLunchBreak || true),
    [slots]
  );

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
    const entries = (visibleEntries ?? []) as Entry[];
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
  }, [visibleEntries, activeSectionId, searchQuery]);

  const unassignedSessions = useMemo(() => {
    const meta = timetable?.metadata as any;
    if (!meta || !Array.isArray(meta.unassigned)) return [];
    const list = meta.unassigned;
    return activeSectionId ? list.filter((u: any) => u.sectionId === activeSectionId) : list;
  }, [timetable, activeSectionId]);

  const publicationMutation = useMutation({
    mutationFn: ({ id, unpublish }: { id: string; unpublish: boolean }) =>
      unpublish ? timetableApi.unpublish(id) : timetableApi.publish(id),
    onSuccess: async (_response, { id: publishedId, unpublish }) => {
      toast.success(unpublish ? 'Timetable unpublished' : 'Timetable published');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['timetable', publishedId] }),
        qc.invalidateQueries({ queryKey: ['timetables'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
        qc.invalidateQueries({ queryKey: ['scheduler-status', publishedId] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Unable to update timetable publication'
      );
    },
  });

  const handlePublish = () => {
    if (!timetable || timetable.status !== 'GENERATED' || publicationMutation.isPending) return;
    if (
      !window.confirm(
        'Publish "' +
          timetable.name +
          '"? This marks the entire timetable, including all divisions, as published.'
      )
    )
      return;
    publicationMutation.mutate({ id: timetable.id, unpublish: false });
  };

  const handleUnpublish = () => {
    if (!timetable || timetable.status !== 'PUBLISHED' || publicationMutation.isPending) return;
    if (
      !window.confirm(
        'Unpublish "' +
          timetable.name +
          '"? It will return to Generated status. All scheduled entries will be kept.'
      )
    )
      return;
    publicationMutation.mutate({ id: timetable.id, unpublish: true });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => timetableApi.remove(id),
    onSuccess: async (_response, deletedId) => {
      const remaining = (timetables ?? []).filter((item: { id: string }) => item.id !== deletedId);
      const nextId = remaining[0]?.id ?? '';
      qc.setQueriesData({ queryKey: ['timetables'] }, (cached: unknown) =>
        Array.isArray(cached)
          ? cached.filter((item: { id: string }) => item.id !== deletedId)
          : cached
      );
      setSelectedId(nextId);
      setSelectedSectionId('');
      setShowUnassignedDrawer(false);
      if (nextId) {
        sessionStorage.setItem('selected-timetable-id', nextId);
      } else {
        sessionStorage.removeItem('selected-timetable-id');
      }
      qc.removeQueries({ queryKey: ['timetable', deletedId] });
      qc.removeQueries({ queryKey: ['scheduler-status', deletedId] });
      qc.removeQueries({ queryKey: ['conflicts', deletedId] });
      toast.success('Timetable deleted');
      await qc.invalidateQueries({ queryKey: ['timetables'] });
    },
    onError: (error: unknown) => {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Unable to delete timetable'
      );
    },
  });

  const handleDelete = () => {
    if (!timetable || deleteMutation.isPending) return;
    if (
      !window.confirm(
        'Delete "' +
          timetable.name +
          '"? This permanently removes the entire timetable, including all divisions, entries and conflicts.'
      )
    )
      return;
    deleteMutation.mutate(timetable.id);
  };

  const moveMutation = useMutation({
    mutationFn: ({
      entryId,
      dayId,
      timeSlotId,
    }: {
      entryId: string;
      dayId: string;
      timeSlotId: string;
    }) =>
      timetableApi.updateSession(
        activeId,
        timetable.entries.find((entry: Entry) => entry.id === entryId).sessionId,
        { dayId, startTimeSlotId: timeSlotId }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable', activeId] });
      qc.invalidateQueries({ queryKey: ['occurrences'] });
      toast.success('Whole session moved');
    },
    onError: (e: unknown) => {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Move failed'
      );
    },
  });

  const onDragStart = (e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('entryId', entryId);
  };

  const onDrop = (e: React.DragEvent, dayId: string, timeSlotId: string, isLunch: boolean) => {
    e.preventDefault();
    if (!canEdit || isLunch || publicationMutation.isPending || deleteMutation.isPending) return;
    const entryId = e.dataTransfer.getData('entryId');
    if (entryId) moveMutation.mutate({ entryId, dayId, timeSlotId });
  };

  const download = async (type: 'excel' | 'pdf') => {
    if (!activeId) return;
    const res =
      type === 'excel'
        ? await timetableApi.exportExcel(activeId)
        : await timetableApi.exportPdf(activeId);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable.${type === 'excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeSectionName =
    uniqueSections.find((s) => s.id === activeSectionId)?.name ?? 'All Divisions';
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  return (
    <div
      className={cn(
        'space-y-4',
        isFitWindow && 'lg:h-[calc(100vh-6rem)] lg:flex lg:flex-col lg:space-y-3 lg:overflow-hidden'
      )}
    >
      {editingSession && timetable && (
        <SessionEditor
          key={editingSession}
          timetable={timetable}
          entries={timetable.entries.filter((entry: Entry) => entry.sessionId === editingSession)}
          days={workingDays}
          slots={teachingSlots}
          onClose={() => setEditingSession(null)}
        />
      )}

      {weekError && !template && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300"
        >
          This timetable is unavailable or unpublished. Refresh the timetable list to pick another.
        </p>
      )}
      {loadingWeek && !template && (
        <p role="status" className="text-xs font-medium text-muted">
          Loading weekly schedule…
        </p>
      )}

      {/* Control Header */}
      <section
        className={cn(
          'surface-card rounded-2xl',
          isFitWindow ? 'p-3.5 sm:px-5 sm:py-3.5 shrink-0' : 'p-4 sm:p-5'
        )}
      >
        <div className="flex flex-col gap-3">
          {/* Top Row: Identity + Quick Export/Manager Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                <CalendarDays size={19} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
                    Academic Timetable
                  </h1>
                  <Badge variant="warning">{timetable?.semester?.name || 'Semester'}</Badge>
                  <span className="hidden sm:inline-flex items-center gap-3 text-[11px] font-medium text-muted ml-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary" /> Lecture
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-600" /> Lab
                    </span>
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {isStudent
                    ? 'Published classes for your division and practical batch.'
                    : template
                      ? 'Weekly template mode — drag a session card or click Edit to adjust.'
                      : 'Dated weekly schedule — holidays and approved leaves are highlighted.'}
                </p>
              </div>
            </div>

            {/* Export & Management Actions */}
            <div className="no-print flex flex-wrap items-center gap-2">
              {!isStudent && (
                <Button
                  variant={template ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTemplate(!template)}
                >
                  <SlidersHorizontal size={13} aria-hidden="true" />
                  {template ? 'Show dated week' : 'Edit weekly template'}
                </Button>
              )}

              <Button
                variant={isFitWindow ? 'default' : 'outline'}
                size="sm"
                className="hidden lg:inline-flex gap-1.5"
                onClick={() => setIsFitWindow((v) => !v)}
                title={
                  isFitWindow
                    ? 'Switch to full scrollable table'
                    : 'Fit entire week in one screen'
                }
              >
                {isFitWindow ? (
                  <Minimize2 size={13} aria-hidden="true" />
                ) : (
                  <Maximize2 size={13} aria-hidden="true" />
                )}
                {isFitWindow ? 'One Window' : 'Full Scroll'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchList();
                  qc.invalidateQueries({ queryKey: ['timetable', activeId] });
                }}
                aria-label="Refresh timetable"
                title="Refresh timetable"
              >
                <RefreshCw size={13} aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => download('excel')}>
                <Download size={13} aria-hidden="true" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => download('pdf')}>
                <Download size={13} aria-hidden="true" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer size={13} aria-hidden="true" /> Print
              </Button>

              {canManage && timetable?.status === 'GENERATED' && (
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={
                    publicationMutation.isPending ||
                    deleteMutation.isPending ||
                    moveMutation.isPending ||
                    isLoading
                  }
                >
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {publicationMutation.isPending ? 'Publishing…' : 'Publish'}
                </Button>
              )}
              {['ADMIN', 'SCHEDULER'].includes(user?.role?.name ?? '') &&
                timetable?.status === 'PUBLISHED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnpublish}
                    disabled={
                      publicationMutation.isPending ||
                      deleteMutation.isPending ||
                      moveMutation.isPending ||
                      isLoading
                    }
                  >
                    <RefreshCw size={13} aria-hidden="true" />
                    {publicationMutation.isPending ? 'Unpublishing…' : 'Unpublish'}
                  </Button>
                )}
              {user?.role?.name === 'ADMIN' && timetable?.status === 'GENERATED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger border-red-300 dark:border-red-800 hover:bg-red-500/10"
                  onClick={handleDelete}
                  disabled={
                    deleteMutation.isPending || publicationMutation.isPending || isLoading
                  }
                >
                  <Trash2 size={13} aria-hidden="true" />
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              )}
            </div>
          </div>

          {/* Filter Strip */}
          <div className="no-print flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-border">
            <Select
              aria-label="Select timetable"
              className="h-9 w-full sm:w-auto sm:min-w-56 text-xs"
              disabled={deleteMutation.isPending || publicationMutation.isPending}
              value={activeId ?? ''}
              onChange={(e) => handleSelect(e.target.value)}
            >
              {(timetables ?? []).length === 0 && <option value="">No timetables available</option>}
              {(timetables ?? []).map((t: { id: string; name: string; status: string }) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </Select>

            {uniqueSections.length > 0 && (
              <Select
                aria-label="Filter by division"
                className="h-9 w-full sm:w-auto sm:min-w-44 text-xs font-semibold border-primary/30 bg-primary/5 dark:bg-blue-500/10 text-primary dark:text-blue-300"
                value={selectedSectionId || (uniqueSections[0] ? '' : 'all')}
                onChange={(e) => setSelectedSectionId(e.target.value)}
              >
                {uniqueSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Division: {sec.name} ({sec.code})
                  </option>
                ))}
                <option value="all">All Divisions (Combined)</option>
              </Select>
            )}

            {(!template || isStudent) && (
              <label className="flex items-center gap-2 text-xs font-medium text-muted">
                <span>Week:</span>
                <input
                  aria-label="Week containing"
                  type="date"
                  className="h-9 rounded-xl border border-border bg-white dark:bg-slate-900 px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  value={week || occurrences?.week || ''}
                  onChange={(e) => setWeek(e.target.value)}
                />
              </label>
            )}

            <div className="relative flex-1 min-w-[180px] sm:max-w-xs ml-auto">
              <Search
                size={14}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                aria-label="Search subject, faculty, or room"
                placeholder="Filter subject, professor, room…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-white dark:bg-slate-900 pl-8 pr-8 text-xs text-foreground placeholder:text-muted outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Grid Viewport Container */}
      {isListLoading || isLoading ? (
        <Skeleton className="h-[500px] rounded-2xl" />
      ) : !activeId ? (
        <div className="surface-card rounded-2xl p-10 text-center text-muted">
          <CalendarDays size={32} className="mx-auto mb-3 opacity-60" aria-hidden="true" />
          <p className="font-semibold text-foreground">No timetables available</p>
          <p className="text-sm mt-1">Generate a timetable from the AI Scheduler page.</p>
        </div>
      ) : (
        <section
          className={cn(
            'surface-card print-area rounded-2xl',
            isFitWindow
              ? 'p-3.5 sm:p-4 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden'
              : 'p-4 sm:p-5 overflow-x-auto'
          )}
        >
          {/* Sub Header Metrics & Badges */}
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5',
              isFitWindow ? 'mb-2.5 shrink-0' : 'mb-4'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-display font-bold text-sm sm:text-base text-foreground truncate">
                {timetable?.name}
              </h2>
              <Badge variant={timetable?.status === 'PUBLISHED' ? 'success' : 'default'}>
                {timetable?.status}
              </Badge>
              {timetable?.score != null && (
                <Badge variant="secondary" className="font-mono tabular-nums hidden sm:inline-flex">
                  Score: {timetable.score}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unassignedSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7.5 px-2.5 text-xs text-amber-800 dark:text-amber-300 border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20 font-semibold gap-1.5 rounded-lg"
                  onClick={() => setShowUnassignedDrawer((v) => !v)}
                >
                  <AlertTriangle size={13} aria-hidden="true" />
                  {unassignedSessions.length} Unscheduled
                </Button>
              )}
              <Badge variant="primary" className="rounded-full px-3">
                Div: {activeSectionName}
              </Badge>
            </div>
          </div>

          {/* Timetable Grid */}
          {isFitWindow ? (
            <div className="lg:flex-1 lg:min-h-0 overflow-x-auto lg:overflow-hidden rounded-xl border border-border bg-card">
              <div className="min-w-[820px] lg:min-w-0 h-full flex flex-col">
                {/* Header Row */}
                <div className="flex w-full bg-surface-subtle text-foreground border-b border-border shrink-0">
                  <div className="w-16 sm:w-20 shrink-0 p-2 text-[10px] font-bold uppercase tracking-wider text-center border-r border-border flex items-center justify-center text-muted">
                    Time
                  </div>
                  {workingDays.map((d: { id: string; shortName: string; name?: string }) => {
                    const isToday = d.shortName.toUpperCase() === todayDayName;
                    return (
                      <div
                        key={d.id}
                        className={cn(
                          'flex-1 min-w-0 p-2 text-center font-display font-bold text-xs border-r border-border last:border-r-0 truncate flex items-center justify-center gap-1.5',
                          isToday &&
                            'bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-blue-300'
                        )}
                      >
                        <span className="truncate">{d.name || d.shortName}</span>
                        {isToday && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-blue-400 shrink-0"
                            title="Today"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grid Body with Strict Equal Rows on Desktop */}
                <div
                  className="flex-1 min-h-0 grid divide-y divide-border"
                  style={{ gridTemplateRows: `repeat(${teachingSlots.length}, minmax(72px, 1fr))` }}
                >
                  {teachingSlots.map(
                    (slot: {
                      id: string;
                      name: string;
                      startTime: string;
                      endTime: string;
                      isLunchBreak: boolean;
                    }) => (
                      <div
                        key={slot.id}
                        className={cn(
                          'flex w-full min-h-0 overflow-hidden',
                          slot.isLunchBreak &&
                            'bg-amber-50/70 dark:bg-amber-950/20'
                        )}
                      >
                        {/* Time Column */}
                        <div className="w-16 sm:w-20 shrink-0 bg-surface-subtle/75 p-1 text-[10px] font-mono flex flex-col justify-center items-center text-center border-r border-border leading-tight tabular-nums">
                          <div className="text-foreground font-semibold">{slot.startTime}</div>
                          <div className="text-muted text-[9px]">{slot.endTime}</div>
                          {slot.isLunchBreak && (
                            <div className="text-amber-700 dark:text-amber-300 font-semibold text-[9px] flex items-center gap-0.5 mt-0.5">
                              <Coffee size={9} aria-hidden="true" /> Break
                            </div>
                          )}
                        </div>

                        {/* Day Columns */}
                        {workingDays.map((day: { id: string }) => {
                          const entriesList = entryMap.get(`${day.id}|${slot.id}`) ?? [];
                          return (
                            <div
                              key={`${day.id}-${slot.id}`}
                              className="flex-1 min-w-0 border-r border-border last:border-r-0 p-1 overflow-hidden flex flex-col justify-center"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onDrop(e, day.id, slot.id, slot.isLunchBreak)}
                            >
                              {entriesList.length > 0 ? (
                                <div
                                  className={cn(
                                    'w-full h-full max-h-full overflow-hidden',
                                    entriesList.length >= 3
                                      ? 'grid grid-cols-3 gap-1 items-stretch'
                                      : entriesList.length === 2
                                        ? 'grid grid-cols-2 gap-1 items-stretch'
                                        : 'flex flex-col justify-center'
                                  )}
                                >
                                  {entriesList.map((entry) => (
                                    <EntryCard
                                      key={entry.id}
                                      entry={entry}
                                      editable={canEdit}
                                      onEdit={setEditingSession}
                                      onDragStart={onDragStart}
                                      compact={true}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="w-full h-full rounded-lg border border-dashed border-border/60 flex items-center justify-center">
                                  {slot.isLunchBreak && (
                                    <span className="text-[9px] font-semibold text-amber-700/70 dark:text-amber-300/70 font-mono uppercase">
                                      Break
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Spacious Scrollable Table View */
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-subtle text-foreground border-b border-border">
                    <th
                      scope="col"
                      className="sticky left-0 bg-surface-subtle p-3 text-left font-bold z-10 w-28 text-xs text-muted uppercase tracking-wider border-r border-border"
                    >
                      Time
                    </th>
                    {workingDays.map((d: { id: string; shortName: string; name?: string }) => (
                      <th
                        scope="col"
                        key={d.id}
                        className="p-3 text-center font-bold text-sm min-w-[220px] font-display border-r border-border last:border-r-0"
                      >
                        {d.name || d.shortName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {teachingSlots.map(
                    (slot: {
                      id: string;
                      name: string;
                      startTime: string;
                      endTime: string;
                      isLunchBreak: boolean;
                    }) => (
                      <tr
                        key={slot.id}
                        className={slot.isLunchBreak ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}
                      >
                        <th
                          scope="row"
                          className="sticky left-0 whitespace-nowrap bg-surface-subtle p-3 text-xs font-semibold border-r border-border z-10 font-mono text-foreground text-left tabular-nums"
                        >
                          <div>
                            {slot.startTime} – {slot.endTime}
                          </div>
                          {slot.isLunchBreak && (
                            <div className="text-amber-700 dark:text-amber-300 font-semibold mt-0.5 flex items-center gap-1">
                              <Coffee size={12} aria-hidden="true" /> Lunch Break
                            </div>
                          )}
                        </th>
                        {workingDays.map((day: { id: string }) => {
                          const entriesList = entryMap.get(`${day.id}|${slot.id}`) ?? [];
                          return (
                            <td
                              key={`${day.id}-${slot.id}`}
                              className="border-r border-border last:border-r-0 p-2 align-top min-w-[220px]"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onDrop(e, day.id, slot.id, slot.isLunchBreak)}
                            >
                              {entriesList.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                  {entriesList.map((entry) => (
                                    <EntryCard
                                      key={entry.id}
                                      entry={entry}
                                      editable={canEdit}
                                      onEdit={setEditingSession}
                                      onDragStart={onDragStart}
                                      compact={false}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="h-20 rounded-xl border border-dashed border-border/70 flex items-center justify-center text-xs text-muted">
                                  {slot.isLunchBreak
                                    ? 'Break'
                                    : canEdit
                                      ? 'Drop session here'
                                      : 'Free period'}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Unscheduled Sessions Drawer */}
          {unassignedSessions.length > 0 && showUnassignedDrawer && (
            <div className="mt-3 shrink-0 max-h-48 overflow-y-auto rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2 text-xs">
                  <AlertTriangle size={15} aria-hidden="true" />
                  Unscheduled Sessions ({unassignedSessions.length})
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-500/15"
                  onClick={() => setShowUnassignedDrawer(false)}
                >
                  <X size={14} aria-hidden="true" /> Close
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {unassignedSessions.map((u: any, index: number) => (
                  <div
                    key={index}
                    className="flex flex-col justify-between p-3 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-card text-xs"
                  >
                    <p className="font-semibold text-foreground truncate flex items-center justify-between gap-2">
                      <span className="truncate">
                        {u.subjectCode} — {u.subjectName || 'Subject'}
                      </span>
                      <Badge variant="warning" className="text-[10px]">
                        {u.isLab ? 'LAB' : 'LECTURE'}
                      </Badge>
                    </p>
                    <p className="text-muted text-[11px] mt-1 truncate">
                      Professor: {u.facultyName || 'Unassigned'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassignedSessions.length === 0 && activeSectionId && !isFitWindow && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold text-success flex items-center gap-2">
                <CheckCircle2 size={15} aria-hidden="true" />
                All subject hours for this division are 100% scheduled.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
