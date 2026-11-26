import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicApi, institutesApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';
import { toast } from 'sonner';

export function HolidaySettings() {
  const user = useAuthStore(s=>s.user);
  const manager = ['ADMIN','INSTITUTE_ADMIN'].includes(user?.role.name || '');
  const global = user?.role.name === 'ADMIN';
  const qc = useQueryClient();
  const [form,setForm] = useState({name:'',date:'',academicYearId:'',instituteId:user?.instituteId || '',isRecurring:false});
  const { data: holidays = [] } = useQuery({queryKey:['holidays',user?.id],queryFn:async()=>(await academicApi.holidays()).data.data});
  const { data: years = [] } = useQuery({queryKey:['academic-years'],queryFn:async()=>(await academicApi.years({limit:100})).data.data,enabled:manager});
  const { data: institutes = [] } = useQuery({queryKey:['institutes'],queryFn:async()=>(await institutesApi.list()).data.data,enabled:global});
  const mutation=useMutation({mutationFn:async(id?:string)=>id?academicApi.deleteHoliday(id):academicApi.createHoliday({...form,instituteId:form.instituteId||null}),onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:['holidays']}),qc.invalidateQueries({queryKey:['occurrences']}),qc.invalidateQueries({queryKey:['resource-timetable']})]);toast.success('Holiday calendar updated');setForm({...form,name:'',date:''});},onError:(e:any)=>toast.error(e.response?.data?.message||'Unable to update holiday calendar')});
  return <section className="mt-6 border-t border-border pt-6 space-y-4"><h3 className="font-bold text-lg">Holiday calendar</h3><p className="text-sm text-muted">Classes are cancelled on these dates. Recurring holidays repeat every year. Approved faculty leave also cancels affected classes.</p>
    {manager && <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();mutation.mutate(undefined);}}>
      <label className="text-sm">Holiday name<input required className="block w-full border border-border rounded p-2 bg-background" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label className="text-sm">Date<input required type="date" className="block w-full border border-border rounded p-2 bg-background" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
      <label className="text-sm">Academic year<select required className="block w-full border border-border rounded p-2 bg-background" value={form.academicYearId} onChange={e=>setForm({...form,academicYearId:e.target.value})}><option value="">Select academic year</option>{years.map((year:any)=><option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
      {global && <label className="text-sm">Institute<select className="block w-full border border-border rounded p-2 bg-background" value={form.instituteId} onChange={e=>setForm({...form,instituteId:e.target.value})}><option value="">All institutes</option>{institutes.map((i:any)=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
      <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={form.isRecurring} onChange={e=>setForm({...form,isRecurring:e.target.checked})}/>Repeat every year</label><Button disabled={mutation.isPending} type="submit">Add holiday</Button>
    </form>}
    <ul className="divide-y divide-border">{holidays.map((holiday:any)=><li key={holiday.id} className="py-3 flex justify-between gap-3"><div className="text-sm"><strong>{holiday.name}</strong> · {holiday.date.slice(0,10)}{holiday.isRecurring?' · Every year':''}<span className="block text-muted">{holiday.instituteId ? institutes.find((i:any)=>i.id===holiday.instituteId)?.name || 'Institute holiday' : 'All institutes'}</span></div>{manager && (global || holiday.instituteId===user?.instituteId) && <Button variant="outline" disabled={mutation.isPending} onClick={()=>{if(window.confirm('Remove this holiday? Teaching will resume on this date if there are no conflicts.'))mutation.mutate(holiday.id);}}>Remove</Button>}</li>)}</ul>
    {!holidays.length && <p className="text-sm text-muted">No holidays have been added.</p>}
  </section>;
}
