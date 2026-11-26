import { Prisma } from '@prisma/client';

export const weekdays = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];
export type CalendarExceptions = {
  holidays: {
    name: string;
    date: Date;
    isRecurring: boolean;
    instituteId: string | null;
    academicYearId: string;
  }[];
  leaves: { facultyId: string; startDate: Date; endDate: Date; status: string }[];
};
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function addDays(date: string, count: number) {
  const result = new Date(date + 'T00:00:00Z');
  result.setUTCDate(result.getUTCDate() + count);
  return dateKey(result);
}
export function occurrenceCancellation(
  date: string,
  instituteId: string,
  academicYearId: string,
  facultyId: string,
  exceptions: CalendarExceptions
): string | null {
  const holiday = exceptions.holidays.find(
    (item) =>
      (!item.instituteId || item.instituteId === instituteId) &&
      (item.isRecurring
        ? dateKey(item.date).slice(5) === date.slice(5)
        : item.academicYearId === academicYearId && dateKey(item.date) === date)
  );
  if (holiday) return 'Holiday: ' + holiday.name;
  if (
    exceptions.leaves.some(
      (item) =>
        item.facultyId === facultyId &&
        item.status === 'APPROVED' &&
        date >= dateKey(item.startDate) &&
        date <= dateKey(item.endDate)
    )
  )
    return 'Faculty on approved leave';
  return null;
}

export function teachingDates(
  semester: { startDate: Date; endDate: Date },
  dayName: string
): string[] {
  const dates: string[] = [];
  let day = dateKey(semester.startDate);
  const end = dateKey(semester.endDate);
  while (day <= end) {
    if (weekdays[new Date(day + 'T00:00:00Z').getUTCDay()] === dayName) dates.push(day);
    day = addDays(day, 1);
  }
  return dates;
}

export function weekMonday(date: string) {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function resolveWeekMonday(
  semester: { startDate: Date; endDate: Date },
  requestedWeek?: string
) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const start = dateKey(semester.startDate);
  const end = dateKey(semester.endDate);
  return weekMonday(
    requestedWeek && requestedWeek !== 'auto'
      ? requestedWeek
      : today >= start && today <= end
        ? today
        : start
  );
}

export async function datedWeekOccurrences<
  T extends {
    facultyId: string;
    day: { name: string };
  },
>(
  db: Prisma.TransactionClient,
  instituteId: string | null,
  semester: { startDate: Date; endDate: Date },
  entries: T[],
  requestedWeek: string | undefined,
  scopeOf: (entry: T) => {
    semester: { startDate: Date; endDate: Date };
    instituteId: string;
    academicYearId: string;
  }
) {
  const week = resolveWeekMonday(semester, requestedWeek);
  const weekEnd = addDays(week, 6);
  const [holidays, leaves] = await Promise.all([
    db.holiday.findMany({
      where: instituteId ? { OR: [{ instituteId: null }, { instituteId }] } : { instituteId: null },
    }),
    db.facultyLeave.findMany({
      where: {
        status: 'APPROVED',
        facultyId: { in: entries.map((e) => e.facultyId) },
        startDate: { lte: new Date(weekEnd) },
        endDate: { gte: new Date(week) },
      },
    }),
  ]);
  return {
    week,
    entries: entries.flatMap((entry) => {
      const scope = scopeOf(entry);
      return teachingDates(scope.semester, entry.day.name)
        .filter((date) => date >= week && date <= weekEnd)
        .map((date) => ({
          ...entry,
          date,
          cancellationReason: occurrenceCancellation(
            date,
            scope.instituteId,
            scope.academicYearId,
            entry.facultyId,
            { holidays, leaves }
          ),
        }));
    }),
  };
}
