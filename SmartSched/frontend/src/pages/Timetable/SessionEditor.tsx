import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Lock, Unlock, Trash2 } from 'lucide-react';
import { facultyApi, roomsApi, labsApi, timetableApi } from '@/api';
import { Button, Label, Select } from '@/components/ui';

export function SessionEditor({
  timetable,
  entries,
  days,
  slots,
  onClose,
}: {
  timetable: any;
  entries: any[];
  days: any[];
  slots: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const first = [...entries].sort((a, b) =>
    a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
  )[0];
  const [form, setForm] = useState({
    dayId: first.dayId,
    startTimeSlotId: first.timeSlotId,
    facultyId: first.facultyId,
    venueId: first.laboratoryId || first.roomId,
    notes: first.notes || '',
  });

  const scope = { instituteId: timetable.instituteId, limit: 100 };
  const { data: faculty = [] } = useQuery({
    queryKey: ['session-faculty', timetable.instituteId],
    queryFn: async () => (await facultyApi.list(scope)).data.data,
  });
  const { data: venues = [] } = useQuery({
    queryKey: ['session-venues', timetable.instituteId, first.isLab],
    queryFn: async () => (await (first.isLab ? labsApi : roomsApi).list(scope)).data.data,
  });

  const locked = entries.some((e) => e.isLocked);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async (action: 'save' | 'delete' | 'lock') => {
      if (action === 'delete') return timetableApi.deleteSession(timetable.id, first.sessionId);
      if (action === 'lock')
        return timetableApi.updateSession(timetable.id, first.sessionId, { isLocked: !locked });
      return timetableApi.updateSession(timetable.id, first.sessionId, {
        dayId: form.dayId,
        startTimeSlotId: form.startTimeSlotId,
        facultyId: form.facultyId,
        notes: form.notes,
        roomId: first.isLab ? null : form.venueId,
        laboratoryId: first.isLab ? form.venueId : null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['timetable'] }),
        qc.invalidateQueries({ queryKey: ['occurrences'] }),
        qc.invalidateQueries({ queryKey: ['resource-timetable'] }),
      ]);
      toast.success('Whole session updated');
      onClose();
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Unable to update this session'),
  });

  const renderSelect = (
    id: string,
    label: string,
    field: 'dayId' | 'startTimeSlotId' | 'facultyId' | 'venueId',
    options: { id: string; label: string }[]
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={form[field]}
        disabled={locked || mutation.isPending}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-title"
        className="surface-card w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3 pb-3 border-b border-border">
          <div>
            <h2 id="session-title" className="font-display font-bold text-lg text-foreground">
              Edit whole session
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {first.courseOffering.subject.name} · {entries.length} consecutive period
              {entries.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} aria-label="Close session editor">
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <p className="text-xs text-muted bg-surface-subtle rounded-xl px-3.5 py-2.5 border border-border">
          Changes apply to every period in this session. The move is saved only when the complete
          session fits without conflicts.
        </p>

        <div className="space-y-3">
          {renderSelect(
            'session-day',
            'Day',
            'dayId',
            days.map((d) => ({ id: d.id, label: d.name }))
          )}
          {renderSelect(
            'session-slot',
            'Starting period',
            'startTimeSlotId',
            slots
              .filter((s) => !s.isLunchBreak)
              .map((s) => ({ id: s.id, label: s.startTime + ' – ' + s.endTime }))
          )}
          {renderSelect(
            'session-faculty',
            'Faculty',
            'facultyId',
            faculty.map((f: any) => ({
              id: f.id,
              label: f.user.firstName + ' ' + f.user.lastName,
            }))
          )}
          {renderSelect(
            'session-venue',
            first.isLab ? 'Laboratory' : 'Classroom',
            'venueId',
            venues.map((v: any) => ({ id: v.id, label: v.code + ' · ' + v.capacity + ' seats' }))
          )}

          <div className="space-y-1.5">
            <Label htmlFor="session-notes">Notes</Label>
            <textarea
              id="session-notes"
              rows={3}
              className="w-full rounded-xl border border-border bg-white dark:bg-slate-900 p-2.5 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              maxLength={1000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
          <Button
            disabled={locked || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => mutation.mutate('save')}
          >
            Save session
          </Button>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate('lock')}
          >
            {locked ? (
              <>
                <Unlock size={14} aria-hidden="true" /> Unlock session
              </>
            ) : (
              <>
                <Lock size={14} aria-hidden="true" /> Lock session
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="text-danger border-red-300 dark:border-red-800 hover:bg-red-500/10 ml-auto"
            disabled={locked || mutation.isPending}
            onClick={() => {
              if (
                window.confirm('Delete all ' + entries.length + ' periods of this session?')
              )
                mutation.mutate('delete');
            }}
          >
            <Trash2 size={14} aria-hidden="true" /> Delete
          </Button>
        </div>
      </section>
    </div>
  );
}
