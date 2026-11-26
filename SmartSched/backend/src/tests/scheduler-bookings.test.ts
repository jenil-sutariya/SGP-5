import { SchedulingEngine } from '../modules/scheduler/scheduler.engine';
import { geneticOptimizer } from '../modules/scheduler/scheduler.genetic';
import { EngineContext, SessionRequest } from '../modules/scheduler/scheduler.types';

const request = (overrides: Partial<SessionRequest> = {}): SessionRequest => ({
  id: 'it-theory',
  courseOfferingId: 'it-course',
  subjectId: 'subject',
  subjectCode: 'IT101',
  subjectName: 'IT',
  subjectType: 'THEORY',
  difficulty: 'EASY',
  facultyId: 'f-it',
  sectionId: 'it-a',
  departmentId: 'it',
  isLab: false,
  consecutiveSlots: 1,
  requiredCapacity: 20,
  priority: 10,
  ...overrides,
});
export function context(): EngineContext {
  return {
    requests: [request()],
    workingDays: [{ id: 'mon', name: 'MONDAY', order: 1 }],
    timeSlots: [1, 2, 3, 4, 5].map((n) => ({
      id: 'p' + n,
      name: 'P' + n,
      order: n,
      isLunchBreak: n === 3,
      durationMins: 60,
      startTime: String(8 + n).padStart(2, '0') + ':00',
      endTime: String(9 + n).padStart(2, '0') + ':00',
    })),
    rooms: [
      { id: 'shared-room', code: 'D101', departmentId: null, instituteId: 'depstar', capacity: 60 },
    ],
    laboratories: [
      {
        id: 'shared-lab',
        code: 'D-LAB',
        departmentId: 'cse',
        instituteId: 'depstar',
        capacity: 100,
      },
    ],
    facultyAvailability: new Map(),
    facultyPreferences: new Map(),
    facultyMaxPerDay: new Map([['f-it', 8]]),
    facultyMaxPerWeek: new Map([['f-it', 20]]),
    softConstraints: [],
    maxIterations: 100,
    departmentCodes: new Map([
      ['it', 'IT'],
      ['cse', 'CSE'],
    ]),
    departmentInstitutes: new Map([
      ['it', 'depstar'],
      ['cse', 'depstar'],
    ]),
    existingBookings: [],
    existingFacultyLoad: [],
  };
}

test('CSE room booking blocks IT for the booked period only', () => {
  const ctx = context();
  ctx.existingBookings = [
    {
      dayId: 'mon',
      timeSlotId: 'p1',
      facultyId: 'f-cse',
      roomId: 'shared-room',
      sectionId: 'cse-a',
    },
  ];
  const before = JSON.stringify(ctx.existingBookings);
  const result = new SchedulingEngine().run(ctx);
  expect(result.assignments).toHaveLength(1);
  expect(result.assignments[0].timeSlotIds).toEqual(['p2']);
  expect(JSON.stringify(ctx.existingBookings)).toBe(before);
});
test('faculty bookings from another department block the same faculty in another room', () => {
  const ctx = context();
  ctx.existingBookings = [
    { dayId: 'mon', timeSlotId: 'p1', facultyId: 'f-it', roomId: 'another-room' },
  ];
  expect(new SchedulingEngine().run(ctx).assignments[0].timeSlotIds).toEqual(['p2']);
});
test('past faculty workload counts towards weekly limits', () => {
  const ctx = context();
  ctx.facultyMaxPerWeek.set('f-it', 2);
  ctx.existingFacultyLoad = [{ facultyId: 'f-it', dayId: 'tue', hours: 2 }];
  const result = new SchedulingEngine().run(ctx);
  expect(result.assignments).toHaveLength(0);
  expect(result.unassigned).toHaveLength(1);
});
test('occupied laboratory cannot be shared even with spare capacity', () => {
  const ctx = context();
  ctx.requests = [
    request({ isLab: true, subjectType: 'LAB', consecutiveSlots: 2, practicalBatchId: 'it-b1' }),
  ];
  ctx.existingBookings = [
    {
      dayId: 'mon',
      timeSlotId: 'p1',
      facultyId: 'f-cse',
      laboratoryId: 'shared-lab',
      sectionId: 'cse-a',
      practicalBatchId: 'cse-b1',
    },
  ];
  expect(new SchedulingEngine().run(ctx).assignments[0].timeSlotIds).toEqual(['p4', 'p5']);
});
test('two lab batches use different blocks when only one laboratory is available', () => {
  const ctx = context();
  ctx.requests = [1, 2].map((n) =>
    request({
      id: 'lab-' + n,
      isLab: true,
      subjectType: 'LAB',
      consecutiveSlots: 2,
      practicalBatchId: 'b' + n,
    })
  );
  const result = new SchedulingEngine().run(ctx);
  expect(result.assignments).toHaveLength(2);
  expect(result.assignments[0].timeSlotIds).not.toEqual(result.assignments[1].timeSlotIds);
});
test('theory cannot overlap any saved practical batch of its division', () => {
  const ctx = context();
  ctx.existingBookings = [
    {
      dayId: 'mon',
      timeSlotId: 'p1',
      facultyId: 'other',
      sectionId: 'it-a',
      practicalBatchId: 'older-batch',
    },
  ];
  expect(new SchedulingEngine().run(ctx).assignments[0].timeSlotIds).toEqual(['p2']);
});
test('all-unavailable faculty is not unrestricted', () => {
  const ctx = context();
  ctx.facultyAvailability.set('f-it', new Set());
  expect(new SchedulingEngine().run(ctx).assignments).toHaveLength(0);
});
test('day-only UNAVAILABLE is a hard constraint', () => {
  const ctx = context();
  ctx.facultyPreferences.set('f-it', [{ key: 'mon|', type: 'UNAVAILABLE', weight: 1 }]);
  expect(new SchedulingEngine().run(ctx).assignments).toHaveLength(0);
});
test('genetic runs preserve existing bookings', () => {
  const ctx = context();
  ctx.existingBookings = [
    { dayId: 'mon', timeSlotId: 'p1', facultyId: 'f-it', roomId: 'shared-room' },
  ];
  const result = geneticOptimizer.optimize(ctx, new SchedulingEngine().run(ctx), 4, 1, 4);
  expect(result.assignments).toHaveLength(1);
  expect(result.assignments.every((a) => !a.timeSlotIds.includes('p1'))).toBe(true);
});
test('no slots means unassigned, without moving saved bookings', () => {
  const ctx = context();
  ctx.existingBookings = ctx.timeSlots.map((s) => ({
    dayId: 'mon',
    timeSlotId: s.id,
    facultyId: 'other',
    roomId: 'shared-room',
  }));
  const result = new SchedulingEngine().run(ctx);
  expect(result.assignments).toHaveLength(0);
  expect(result.unassigned).toHaveLength(1);
});
