import {
  occurrenceCancellation,
  teachingDates,
  weekMonday,
} from '../modules/timetable/occurrence.rules';
import { venueSatisfies } from '../modules/scheduler/venue.rules';

test('equipment tokens normalize case and spacing and require every item', () => {
  expect(
    venueSatisfies(
      { capacity: 40, equipment: '  Computers ; Oscilloscope ', roomTypeId: 'lab' },
      30,
      [{ roomTypeId: 'lab', equipment: 'COMPUTERS,oscilloscope' }]
    )
  ).toBe(true);
  expect(
    venueSatisfies({ capacity: 40, equipment: 'computers' }, 30, [
      { equipment: 'computers,projector' },
    ])
  ).toBe(false);
  expect(
    venueSatisfies({ capacity: 40, equipment: 'computers', hasProjector: true }, 30, [
      { equipment: 'projector,computers' },
    ])
  ).toBe(true);
});
test('venue type and minimum capacity are hard requirements', () => {
  expect(venueSatisfies({ capacity: 40, roomTypeId: 'class' }, 30, [{ roomTypeId: 'lab' }])).toBe(
    false
  );
  expect(venueSatisfies({ capacity: 40 }, 30, [{ minCapacity: 50 }])).toBe(false);
  expect(venueSatisfies({ capacity: 20 }, 30, [])).toBe(false);
});
test('calendar applies institute holidays, recurring dates and inclusive approved leave', () => {
  const holidays = [
    {
      name: 'Institute day',
      date: new Date('2025-10-12'),
      isRecurring: true,
      instituteId: 'depstar',
      academicYearId: 'old',
    },
  ];
  const leaves = [
    {
      facultyId: 'f1',
      startDate: new Date('2026-10-13'),
      endDate: new Date('2026-10-14'),
      status: 'APPROVED',
    },
  ];
  expect(occurrenceCancellation('2026-10-12', 'depstar', 'new', 'f1', { holidays, leaves })).toBe(
    'Holiday: Institute day'
  );
  expect(
    occurrenceCancellation('2026-10-12', 'cspit', 'new', 'f1', { holidays, leaves })
  ).toBeNull();
  expect(occurrenceCancellation('2026-10-13', 'depstar', 'new', 'f1', { holidays, leaves })).toBe(
    'Faculty on approved leave'
  );
  expect(occurrenceCancellation('2026-10-14', 'depstar', 'new', 'f1', { holidays, leaves })).toBe(
    'Faculty on approved leave'
  );
  expect(
    occurrenceCancellation('2026-10-15', 'depstar', 'new', 'f1', { holidays, leaves })
  ).toBeNull();
  expect(
    occurrenceCancellation('2026-10-14', 'depstar', 'new', 'f2', { holidays, leaves })
  ).toBeNull();
  expect(
    occurrenceCancellation('2026-10-14', 'depstar', 'new', 'f1', {
      holidays,
      leaves: leaves.map((l) => ({ ...l, status: 'PENDING' })),
    })
  ).toBeNull();
});
test('dated weeks include only occurrences within semester boundaries', () => {
  expect(
    teachingDates({ startDate: new Date('2026-10-13'), endDate: new Date('2026-10-20') }, 'MONDAY')
  ).toEqual(['2026-10-19']);
  expect(weekMonday('2026-10-18')).toBe('2026-10-12');
});
