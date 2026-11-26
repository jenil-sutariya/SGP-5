import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { academicApi, institutesApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, Select, Label, Badge } from '@/components/ui';
import { toast } from 'sonner';

export function HolidaySettings() {
  const user = useAuthStore((s) => s.user);
  const manager = ['ADMIN', 'INSTITUTE_ADMIN'].includes(user?.role.name || '');
  const global = user?.role.name === 'ADMIN';
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    date: '',
    academicYearId: '',
    instituteId: user?.instituteId || '',
    isRecurring: false,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', user?.id],
    queryFn: async () => (await academicApi.holidays()).data.data,
  });
  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => (await academicApi.years({ limit: 100 })).data.data,
    enabled: manager,
  });
  const { data: institutes = [] } = useQuery({
    queryKey: ['institutes'],
    queryFn: async () => (await institutesApi.list()).data.data,
    enabled: global,
  });

  const mutation = useMutation({
    mutationFn: async (id?: string) =>
      id
        ? academicApi.deleteHoliday(id)
        : academicApi.createHoliday({ ...form, instituteId: form.instituteId || null }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['holidays'] }),
        qc.invalidateQueries({ queryKey: ['occurrences'] }),
        qc.invalidateQueries({ queryKey: ['resource-timetable'] }),
      ]);
      toast.success('Holiday calendar updated');
      setForm({ ...form, name: '', date: '' });
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || 'Unable to update holiday calendar'),
  });

  return (
    <section className="mt-6 border-t border-border pt-6 space-y-4">
      <div className="flex items-start gap-2.5">
        <CalendarOff size={18} className="text-primary dark:text-cyan-accent mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Holiday Calendar</h2>
          <p className="text-sm text-muted mt-0.5">
            Classes are cancelled on these dates. Recurring holidays repeat every year. Approved
            faculty leave also cancels affected classes.
          </p>
        </div>
      </div>

      {manager && (
        <form
          className="rounded-xl border border-border bg-surface-subtle/50 p-4 grid gap-3 sm:grid-cols-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(undefined);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="holiday-name">Holiday name</Label>
            <Input
              id="holiday-name"
              required
              placeholder="e.g. Republic Day"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="holiday-date">Date</Label>
            <Input
              id="holiday-date"
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="holiday-year">Academic year</Label>
            <Select
              id="holiday-year"
              required
              value={form.academicYearId}
              onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
            >
              <option value="">Select academic year</option>
              {years.map((year: any) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </div>

          {global && (
            <div className="space-y-1">
              <Label htmlFor="holiday-institute">Institute</Label>
              <Select
                id="holiday-institute"
                value={form.instituteId}
                onChange={(e) => setForm({ ...form, instituteId: e.target.value })}
              >
                <option value="">All institutes</option>
                {institutes.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <label className="text-sm font-medium text-foreground flex gap-2 items-center cursor-pointer py-2">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              className="h-4 w-4 rounded text-primary focus:ring-primary"
            />
            Repeat every year
          </label>

          <Button disabled={mutation.isPending} loading={mutation.isPending} type="submit">
            <Plus size={15} aria-hidden="true" /> Add holiday
          </Button>
        </form>
      )}

      {holidays.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {holidays.map((holiday: any) => (
            <li
              key={holiday.id}
              className="p-3.5 flex items-center justify-between gap-3 bg-card hover:bg-surface-subtle/40 transition-colors"
            >
              <div className="text-sm min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-foreground">{holiday.name}</strong>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {holiday.date.slice(0, 10)}
                  </span>
                  {holiday.isRecurring && <Badge variant="secondary">Annual</Badge>}
                </div>
                <span className="block text-xs text-muted mt-0.5">
                  {holiday.instituteId
                    ? institutes.find((i: any) => i.id === holiday.instituteId)?.name ||
                      'Institute holiday'
                    : 'All institutes'}
                </span>
              </div>
              {manager && (global || holiday.instituteId === user?.instituteId) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  className="text-danger hover:bg-red-500/10"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Remove this holiday? Teaching will resume on this date if there are no conflicts.'
                      )
                    )
                      mutation.mutate(holiday.id);
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" /> Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted py-4 text-center rounded-xl border border-dashed border-border">
          No holidays have been added.
        </p>
      )}
    </section>
  );
}
