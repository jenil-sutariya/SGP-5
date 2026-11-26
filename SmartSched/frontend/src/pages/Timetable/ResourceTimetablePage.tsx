import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, DoorOpen, FlaskConical, RefreshCw, Printer } from 'lucide-react';
import { timetableApi } from '@/api';
import { Button, Skeleton } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { buildResourceTimeline, periodsOverlap, type ResourcePeriod } from './resourceTimeline';

type Day = { name: string; shortName: string; order: number };
type ResourceSchedule = {
  week?: string;
  resource: {
    id: string;
    code: string;
    name: string;
    capacity: number;
    building: string;
    institute: { name: string; code: string } | null;
  };
  semesters: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    academicYear: { name: string };
  }[];
  selectedSemesterId: string | null;
  days: Day[];
  timeSlots: ResourcePeriod[];
  entries: {
    id: string;
    date?: string;
    cancellationReason?: string | null;
    day: Day;
    timeSlot: ResourcePeriod;
    courseOffering: { subject: { code: string; name: string } };
    faculty: { user: { firstName: string; lastName: string } };
    section: { name: string; code: string; department: { code: string } } | null;
    practicalBatch: { name: string } | null;
    timetable: {
      id: string;
      name: string;
      status: string;
      semester: { name: string; startDate: string; endDate: string };
    };
  }[];
};
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ResourceTimetablePage({ kind }: { kind: 'room' | 'lab' }) {
  const { resourceId = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  const [semesterId, setSemesterId] = useState('');
  const [week, setWeek] = useState('auto');
  const listPath = kind === 'room' ? '/rooms' : '/labs';
  const label = kind === 'room' ? 'Classroom' : 'Laboratory';
  const Icon = kind === 'room' ? DoorOpen : FlaskConical;
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['resource-timetable', user?.id, kind, resourceId, semesterId, week],
    enabled: !!resourceId,
    queryFn: async () =>
      (await timetableApi.viewResource(kind, resourceId, semesterId || undefined, week)).data
        .data as ResourceSchedule,
    retry: false,
  });
  const days = useMemo(() => {
    const byName = new Map<string, Day>();
    for (const day of [...(data?.days ?? []), ...(data?.entries.map((entry) => entry.day) ?? [])])
      byName.set(day.name, day);
    return [...byName.values()].sort((a, b) => a.order - b.order);
  }, [data]);
  const periods = useMemo(
    () =>
      buildResourceTimeline([
        ...(data?.timeSlots ?? []),
        ...(data?.entries.map((entry) => entry.timeSlot) ?? []),
      ]),
    [data]
  );
  const selectedSemester = data?.semesters.find(
    (semester) => semester.id === data.selectedSemesterId
  );

  return (
    <div className="space-y-5 pb-6">
      <Link
        to={listPath}
        className="no-print inline-flex items-center gap-2 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to {kind === 'room' ? 'classrooms' : 'laboratories'}
      </Link>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Icon size={23} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {data ? data.resource.code + ' · ' + data.resource.name : label + ' timetable'}
            </h1>
            <p className="text-sm text-muted mt-1">
              {data
                ? `${data.resource.institute?.code ?? 'Institute unassigned'} · ${data.resource.building} · Capacity ${data.resource.capacity}`
                : 'Weekly resource timetable'}
            </p>
          </div>
        </div>
        <div className="no-print flex flex-wrap items-end gap-2">
          {data && data.semesters.length > 0 && (
            <label className="text-xs font-medium text-muted">
              <span className="block mb-1">Academic period</span>
              <select
                className="h-10 max-w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground dark:bg-slate-900"
                value={semesterId || data.selectedSemesterId || ''}
                onChange={(event) => { setSemesterId(event.target.value); setWeek('auto'); }}
              >
                {data.semesters.map((semester) => (
                  <option value={semester.id} key={semester.id}>
                    {semester.academicYear.name} · {semester.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs">Week containing<input type="date" aria-label="Resource week" className="block h-10 rounded-lg border border-border bg-background p-2" value={week === 'auto' ? data?.week || '' : week} onChange={e=>setWeek(e.target.value || 'auto')}/></label>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!data}
            className="gap-2"
          >
            <Printer size={15} /> Print
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : isError || !data ? (
        <div role="alert" className="rounded-xl border border-border p-6">
          <h2 className="font-semibold">Unable to load this timetable</h2>
          <p className="text-sm text-muted mt-2">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Please try again.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {data.entries.filter(entry=>!entry.cancellationReason).length} booked periods · All departments using this{' '}
                {kind === 'room' ? 'classroom' : 'lab'}
              </p>
              {selectedSemester && (
                <p className="text-xs text-muted mt-1">
                  {dateLabel(selectedSemester.startDate)} – {dateLabel(selectedSemester.endDate)}.
                  Includes bookings from semesters that overlap these dates.
                </p>
              )}
              <p className="text-xs text-muted mt-1">
                Generated and published teaching is shown for this week. Cancelled sessions do not reserve this resource.
              </p>
            </div>
            <div className="flex gap-3 items-center text-xs">
              <span className="text-amber-700 dark:text-amber-300">● Generated</span>
              <span className="text-emerald-700 dark:text-emerald-300">● Published</span>
            </div>
          </div>
          {data.entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <CalendarDays size={25} className="mx-auto mb-2 text-muted" />
              <h2 className="font-medium">No bookings for this academic period</h2>
              <p className="text-sm text-muted mt-1">
                {data.semesters.length
                  ? 'Choose another period to view its bookings.'
                  : 'Add an academic semester before generating a timetable.'}
              </p>
            </div>
          )}
          {periods.length > 0 && days.length > 0 && (
            <div className="print-area overflow-x-auto rounded-2xl border border-border bg-white dark:bg-slate-900">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
                <caption className="sr-only">Weekly timetable for {data.resource.code}</caption>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th scope="col" className="w-28 p-3 text-left border-b border-border">
                      Time
                    </th>
                    {days.map((day) => (
                      <th
                        scope="col"
                        key={day.name}
                        className="p-3 border-b border-l border-border text-left capitalize"
                      >
                        {day.name.toLowerCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.startTime + period.endTime}>
                      <th
                        scope="row"
                        className="p-3 align-top text-left text-xs font-medium border-b border-border"
                      >
                        {period.startTime}
                        <br />
                        <span className="text-muted">{period.endTime}</span>
                      </th>
                      {days.map((day) => {
                        const bookings = data.entries.filter(
                          (entry) =>
                            entry.day.name === day.name && periodsOverlap(entry.timeSlot, period)
                        );
                        return (
                          <td
                            key={day.name}
                            className="p-2 align-top border-l border-b border-border"
                          >
                            {bookings.length ? (
                              <div className="space-y-2">
                                {bookings.map((entry) => (
                                  <article
                                    key={entry.id}
                                    className={`rounded-lg border p-2.5 ${entry.timetable.status === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30'}`}
                                  >
                                    {entry.cancellationReason && <p className="text-xs font-bold text-red-700 dark:text-red-300">Cancelled · {entry.cancellationReason}</p>}
                                    <p className="font-semibold text-xs break-words">
                                      {entry.courseOffering.subject.code}
                                    </p>
                                    <p className="text-xs mt-1 break-words">
                                      {entry.courseOffering.subject.name}
                                    </p>
                                    <p className="text-xs text-muted mt-2">
                                      {entry.faculty.user.firstName} {entry.faculty.user.lastName}
                                    </p>
                                    <p className="text-xs mt-1 font-medium">
                                      {entry.section?.department.code} ·{' '}
                                      {entry.section?.name ?? 'No division'}
                                      {entry.practicalBatch
                                        ? ' · ' + entry.practicalBatch.name
                                        : ''}
                                    </p>
                                    <p className="text-[11px] text-muted mt-2">
                                      {entry.timeSlot.startTime}–{entry.timeSlot.endTime} ·{' '}
                                      {entry.timetable.status === 'PUBLISHED'
                                        ? 'Published'
                                        : 'Generated'}
                                    </p>
                                    <p className="text-[11px] text-muted mt-1 break-words">
                                      {entry.timetable.name} · {entry.timetable.semester.name}
                                    </p>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted text-center py-4">
                                {period.isLunchBreak ? 'Break' : 'No booking'}
                              </p>
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
        </>
      )}
    </div>
  );
}
