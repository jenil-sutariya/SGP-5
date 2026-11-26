import { describe, expect, it } from 'vitest';
import { buildResourceTimeline, periodsOverlap } from './resourceTimeline';

describe('resource timetable clock intervals', () => {
  it('shows a partial booking across every occupied segment', () => {
    const calendar = { startTime: '09:00', endTime: '10:00', isLunchBreak: false };
    const booking = { startTime: '09:30', endTime: '10:30', isLunchBreak: false };
    const rows = buildResourceTimeline([calendar, booking]);
    expect(rows.map((row) => row.startTime)).toEqual(['09:00', '09:30', '10:00']);
    expect(rows.filter((row) => periodsOverlap(booking, row))).toHaveLength(2);
  });
  it('merges identical clock periods and excludes gaps between sessions', () => {
    const slot = { startTime: '09:00', endTime: '10:00', isLunchBreak: false };
    expect(
      buildResourceTimeline([slot, slot, { ...slot, startTime: '11:00', endTime: '12:00' }])
    ).toHaveLength(2);
  });
  it('does not treat adjacent periods as overlapping', () => {
    expect(
      periodsOverlap(
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' }
      )
    ).toBe(false);
  });
  it('retains breaks and handles an empty calendar', () => {
    expect(buildResourceTimeline([])).toEqual([]);
    expect(
      buildResourceTimeline([{ startTime: '12:00', endTime: '13:00', isLunchBreak: true }])[0]
        .isLunchBreak
    ).toBe(true);
  });
});
