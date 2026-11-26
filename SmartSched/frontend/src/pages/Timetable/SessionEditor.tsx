import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { facultyApi, roomsApi, labsApi, timetableApi } from '@/api';
import { Button } from '@/components/ui';

export function SessionEditor({ timetable, entries, days, slots, onClose }: {
  timetable: any; entries: any[]; days: any[]; slots: any[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const first = [...entries].sort((a,b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime))[0];
  const [form, setForm] = useState({ dayId: first.dayId, startTimeSlotId: first.timeSlotId, facultyId: first.facultyId, venueId: first.laboratoryId || first.roomId, notes: first.notes || '' });
  const scope = { instituteId: timetable.instituteId, limit: 100 };
  const { data: faculty = [] } = useQuery({ queryKey: ['session-faculty', timetable.instituteId], queryFn: async () => (await facultyApi.list(scope)).data.data });
  const { data: venues = [] } = useQuery({ queryKey: ['session-venues', timetable.instituteId, first.isLab], queryFn: async () => (await (first.isLab ? labsApi : roomsApi).list(scope)).data.data });
  const locked = entries.some(e => e.isLocked);
  const mutation = useMutation({
    mutationFn: async (action: 'save' | 'delete' | 'lock') => {
      if (action === 'delete') return timetableApi.deleteSession(timetable.id, first.sessionId);
      if (action === 'lock') return timetableApi.updateSession(timetable.id, first.sessionId, { isLocked: !locked });
      return timetableApi.updateSession(timetable.id, first.sessionId, { dayId: form.dayId, startTimeSlotId: form.startTimeSlotId, facultyId: form.facultyId, notes: form.notes, roomId: first.isLab ? null : form.venueId, laboratoryId: first.isLab ? form.venueId : null });
    },
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['timetable'] }), qc.invalidateQueries({ queryKey: ['occurrences'] }), qc.invalidateQueries({ queryKey: ['resource-timetable'] })]); toast.success('Whole session updated'); onClose(); },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Unable to update this session'),
  });
  const select = (label: string, field: 'dayId'|'startTimeSlotId'|'facultyId'|'venueId', options: {id:string;label:string}[]) => <label className="block text-sm space-y-1">{label}<select className="w-full rounded-lg border border-border p-2 bg-background" value={form[field]} disabled={locked || mutation.isPending} onChange={e=>setForm({...form,[field]:e.target.value})}>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
  return <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="session-title" className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between items-start"><div><h2 id="session-title" className="font-bold text-lg">Edit whole session</h2><p className="text-sm text-muted">{first.courseOffering.subject.name} · {entries.length} consecutive period{entries.length===1?'':'s'}</p></div><Button variant="ghost" onClick={onClose} aria-label="Close session editor">×</Button></div>
      <p className="text-sm text-muted">Changes apply to every period in this session. The move is saved only when the complete session fits.</p>
      {select('Day','dayId',days.map(d=>({id:d.id,label:d.name})))}
      {select('Starting period','startTimeSlotId',slots.filter(s=>!s.isLunchBreak).map(s=>({id:s.id,label:s.startTime+' – '+s.endTime})))}
      {select('Faculty','facultyId',faculty.map((f:any)=>({id:f.id,label:f.user.firstName+' '+f.user.lastName})))}
      {select(first.isLab?'Laboratory':'Classroom','venueId',venues.map((v:any)=>({id:v.id,label:v.code+' · '+v.capacity+' seats'})))}
      <label className="block text-sm">Notes<textarea className="w-full rounded-lg border border-border p-2 bg-background" maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      <div className="flex flex-wrap gap-2"><Button disabled={locked || mutation.isPending} onClick={()=>mutation.mutate('save')}>Save session</Button><Button variant="outline" disabled={mutation.isPending} onClick={()=>mutation.mutate('lock')}>{locked?'Unlock session':'Lock session'}</Button><Button variant="outline" disabled={locked || mutation.isPending} onClick={()=>{if(window.confirm('Delete all '+entries.length+' periods of this session?'))mutation.mutate('delete');}}>Delete session</Button></div>
    </section>
  </div>;
}
