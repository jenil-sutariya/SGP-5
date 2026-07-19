import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { academicApi, timetableApi } from '@/api';
import { Button, Card, Badge, Skeleton } from '@/components/ui';
import { cn } from '@/utils/cn';

type Entry = {
  id: string;
  dayId: string;
  timeSlotId: string;
  isLab: boolean;
  day: { id: string; name: string; order: number; shortName: string };
  timeSlot: { id: string; name: string; order: number; startTime: string; endTime: string; isLunchBreak: boolean };
  courseOffering: { subject: { code: string; name: string; type: string } };
  faculty: { user: { firstName: string; lastName: string } };
  room?: { code: string } | null;
  laboratory?: { code: string } | null;
  section?: { id: string; code: string; name: string } | null;
  practicalBatch?: { id: string; name: string; code: string } | null;
};

export default function TimetablePage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>(
    () => sessionStorage.getItem('selected-timetable-id') ?? ''
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const { data: timetables, refetch: refetchList } = useQuery({
    queryKey: ['timetables'],
    queryFn: async () => (await timetableApi.list({ limit: 50, sortBy: 'createdAt', sortOrder: 'desc' })).data.data,
    staleTime: 0,
  });

  const activeId = selectedId || timetables?.[0]?.id;

  // Persist selected timetable across navigation
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedSectionId(''); // Reset section filter when changing timetable
    sessionStorage.setItem('selected-timetable-id', id);
  };

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', activeId],
    enabled: !!activeId,
    staleTime: 0,
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
    queryKey: ['days'],
    queryFn: async () => (await academicApi.days()).data.data,
  });
  const { data: slots = [] } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => (await academicApi.timeSlots()).data.data,
  });

  const workingDays = useMemo(() => days.filter((d: { isWorking: boolean }) => d.isWorking), [days]);
  const teachingSlots = useMemo(() => slots.filter((s: { isLunchBreak: boolean }) => !s.isLunchBreak || true), [slots]);

  // Extract all unique sections that have entries in the current timetable
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

  // Determine active section filter (defaults to first section to avoid mixed view, unless explicitly 'all')
  const activeSectionId = useMemo(() => {
    if (selectedSectionId === 'all') return '';
    if (selectedSectionId) return selectedSectionId;
    return uniqueSections[0]?.id ?? '';
  }, [selectedSectionId, uniqueSections]);

  const entryMap = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const entries = (timetable?.entries ?? []) as Entry[];
    const filtered = activeSectionId
      ? entries.filter((e) => e.section?.id === activeSectionId)
      : entries;

    for (const e of filtered) {
      const key = `${e.dayId}|${e.timeSlotId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [timetable, activeSectionId]);

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

  const activeSectionName = uniqueSections.find((s) => s.id === activeSectionId)?.name ?? 'Combined View';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Timetable</h2>
          <p className="text-sm text-muted">Weekly grid view filtered by division/class</p>
        </div>
        <div className="no-print flex flex-wrap gap-2 items-center">
          {/* Timetable Selector */}
          <select
            className="h-10 rounded-xl border border-border bg-white/60 px-3 text-sm dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={activeId ?? ''}
            onChange={(e) => handleSelect(e.target.value)}
          >
            {(timetables ?? []).length === 0 && <option value="">No timetables — generate one in Scheduler</option>}
            {(timetables ?? []).map((t: { id: string; name: string; status: string }) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.status})
              </option>
            ))}
          </select>

          {/* Division Selector */}
          {uniqueSections.length > 0 && (
            <select
              className="h-10 rounded-xl border border-primary/40 bg-primary/5 px-3 text-sm font-medium text-primary dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={selectedSectionId || (uniqueSections[0] ? '' : 'all')}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {uniqueSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Division: {sec.name} ({sec.code})
                </option>
              ))}
              <option value="all">All Divisions (Combined View)</option>
            </select>
          )}

          <Button variant="outline" onClick={() => { refetchList(); qc.invalidateQueries({ queryKey: ['timetable', activeId] }); }}>
            ↻ Refresh
          </Button>
          <Button variant="outline" onClick={() => download('excel')}>
            <Download size={16} /> Excel
          </Button>
          <Button variant="outline" onClick={() => download('pdf')}>
            <Download size={16} /> PDF
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
        </div>
      </div>

      {isLoading || !activeId ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="print-area overflow-x-auto p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{timetable?.name}</h3>
              <Badge>{timetable?.status}</Badge>
              {timetable?.score != null && <Badge variant="secondary">Score {timetable.score}</Badge>}
            </div>
            <Badge variant="primary" className="text-sm font-semibold px-3 py-1">
              Showing: {activeSectionName}
            </Badge>
          </div>
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white/80 p-2 text-left dark:bg-slate-900/80">Time</th>
                {workingDays.map((d: { id: string; shortName: string }) => (
                  <th key={d.id} className="p-2 text-center">
                    {d.shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachingSlots.map((slot: { id: string; name: string; startTime: string; endTime: string; isLunchBreak: boolean }) => (
                <tr key={slot.id} className={slot.isLunchBreak ? 'bg-warning/10' : ''}>
                  <td className="sticky left-0 whitespace-nowrap bg-white/80 p-2 text-xs font-medium dark:bg-slate-900/80">
                    {slot.startTime}-{slot.endTime}
                    {slot.isLunchBreak && <div className="text-warning">Break</div>}
                  </td>
                  {workingDays.map((day: { id: string }) => {
                    const entriesList = entryMap.get(`${day.id}|${slot.id}`) ?? [];
                    return (
                      <td
                        key={`${day.id}-${slot.id}`}
                        className="border border-border/50 p-1 align-top"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, day.id, slot.id, slot.isLunchBreak)}
                      >
                        {entriesList.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {entriesList.map((entry) => (
                              <div
                                key={entry.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, entry.id)}
                                className={cn(
                                  'cursor-grab rounded-lg p-2 text-xs shadow-sm',
                                  entry.isLab ? 'bg-secondary/15 text-secondary' : 'bg-primary/10 text-primary'
                                )}
                              >
                                <p className="font-bold">{entry.courseOffering.subject.code}</p>
                                <p className="opacity-80">
                                  {entry.faculty.user.firstName} {entry.faculty.user.lastName}
                                </p>
                                <p className="opacity-70">
                                  {entry.room?.code ?? entry.laboratory?.code} · {entry.section?.code}
                                  {entry.practicalBatch ? ` (${entry.practicalBatch.name})` : ''}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-16 rounded-lg border border-dashed border-border/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Remaining (Unassigned) Subjects Display */}
          {unassignedSessions.length > 0 && (
            <div className="mt-6 border-t border-border/60 pt-4 no-print">
              <h4 className="font-display font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-3">
                ⚠️ Remaining Subjects to Schedule (Unscheduled Hours):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedSessions.map((u: any, index: number) => (
                  <div
                    key={index}
                    className="flex flex-col justify-between p-3 rounded-xl border border-amber-200/50 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10 text-xs shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-sm text-amber-800 dark:text-amber-400">
                        {u.subjectCode} - {u.subjectName || 'Subject'}
                      </p>
                      <p className="text-muted-foreground mt-1 font-medium">
                        Professor: {u.facultyName || 'Not Assigned'}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:bg-amber-950/20">
                        {u.isLab ? 'Practical / Lab' : 'Theory'}
                      </Badge>
                      {u.practicalBatchId && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Batch: {u.practicalBatchId.split('-').pop()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassignedSessions.length === 0 && activeSectionId && (
            <div className="mt-6 border-t border-border/60 pt-4 no-print">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                🎉 All weekly hours for this division's subjects have been successfully scheduled!
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
