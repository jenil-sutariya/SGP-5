export type ResourcePeriod = { startTime: string; endTime: string; isLunchBreak: boolean };

export function timeMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function periodsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
) {
  return (
    timeMinutes(a.startTime) < timeMinutes(b.endTime) &&
    timeMinutes(b.startTime) < timeMinutes(a.endTime)
  );
}

// Split on clock boundaries so differently named/overlapping periods never hide a booking.
export function buildResourceTimeline(periods: ResourcePeriod[]): ResourcePeriod[] {
  const boundaries = [
    ...new Set(
      periods.flatMap((period) => [timeMinutes(period.startTime), timeMinutes(period.endTime)])
    ),
  ].sort((a, b) => a - b);
  const format = (value: number) =>
    String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  const rows: ResourcePeriod[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const row = {
      startTime: format(boundaries[i]),
      endTime: format(boundaries[i + 1]),
      isLunchBreak: false,
    };
    const coveredBy = periods.filter((period) => periodsOverlap(period, row));
    if (coveredBy.length)
      rows.push({ ...row, isLunchBreak: coveredBy.every((period) => period.isLunchBreak) });
  }
  return rows;
}
