jest.mock('../database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    semester: { findUnique: jest.fn() },
    department: { findUnique: jest.fn() },
    timetable: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    timetableEntry: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
  },
}));
jest.mock('../modules/timetable/conflict.service', () => ({
  ConflictService: jest
    .fn()
    .mockImplementation(() => ({ detectAndPersist: jest.fn().mockResolvedValue([]) })),
}));
import prisma from '../database/prisma';
import { SchedulerService } from '../modules/scheduler/scheduler.service';
import { EngineContext } from '../modules/scheduler/scheduler.types';
import { activeBookingWhere } from '../modules/scheduler/scheduler.bookings';
import { schedulingEngine } from '../modules/scheduler/scheduler.engine';
import { geneticOptimizer } from '../modules/scheduler/scheduler.genetic';

const semester = {
  id: 'sem',
  academicYearId: 'year',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-12-31'),
};
const input = {
  semesterId: 'sem',
  academicYearId: 'year',
  departmentId: 'it',
  instituteId: 'depstar',
  useGenetic: false,
};
let ctx: EngineContext;
const oldEntry = (changes = {}) => ({
  id: 'saved',
  timetableId: 'cse-timetable',
  courseOfferingId: 'cse-offering',
  facultyId: 'cse-teacher',
  sectionId: 'cse-a',
  practicalBatchId: null,
  roomId: 'room',
  laboratoryId: null,
  dayId: 'mon',
  timeSlotId: 'p1',
  isLab: false,
  day: { name: 'MONDAY' },
  timeSlot: { startTime: '09:00', endTime: '10:00' },
  timetable: { semesterId: 'sem' },
  ...changes,
});
beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
  (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ acquired: true }]);
  (prisma.semester.findUnique as jest.Mock).mockResolvedValue(semester);
  (prisma.department.findUnique as jest.Mock).mockResolvedValue({
    id: 'it',
    instituteId: 'depstar',
  });
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([oldEntry()]);
  (prisma.timetableEntry.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.timetable.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.timetable.create as jest.Mock).mockResolvedValue({ id: 'new-it' });
  (prisma.timetable.update as jest.Mock).mockImplementation((arg) =>
    Promise.resolve({ id: arg.where.id, ...arg.data })
  );
  ctx = {
    requests: [
      {
        id: 'req',
        courseOfferingId: 'it-offering',
        subjectId: 'subject',
        subjectCode: 'IT101',
        subjectName: 'IT',
        subjectType: 'THEORY',
        difficulty: 'EASY',
        facultyId: 'it-teacher',
        sectionId: 'it-a',
        departmentId: 'it',
        isLab: false,
        consecutiveSlots: 1,
        requiredCapacity: 20,
        priority: 10,
      },
    ],
    workingDays: [{ id: 'mon', name: 'MONDAY', order: 1 }],
    timeSlots: [1, 2, 3].map((n) => ({
      id: 'p' + n,
      name: 'P' + n,
      order: n,
      startTime: String(8 + n).padStart(2, '0') + ':00',
      endTime: String(9 + n).padStart(2, '0') + ':00',
      durationMins: 60,
      isLunchBreak: false,
    })),
    rooms: [{ id: 'room', code: 'D101', departmentId: null, instituteId: 'depstar', capacity: 60 }],
    laboratories: [],
    facultyAvailability: new Map(),
    facultyPreferences: new Map(),
    facultyMaxPerDay: new Map(),
    facultyMaxPerWeek: new Map(),
    softConstraints: [],
    maxIterations: 100,
    departmentInstitutes: new Map([['it', 'depstar']]),
  };
  jest
    .spyOn(SchedulerService.prototype as any, 'buildContext')
    .mockImplementation(async () => structuredClone(ctx));
});

afterEach(() => jest.restoreAllMocks());

test('generation preserves CSE and inserts IT only in an available room period', async () => {
  await new SchedulerService().generate(input);
  expect(prisma.timetableEntry.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { timetable: activeBookingWhere(semester) } })
  );
  const saved = (prisma.timetableEntry.createMany as jest.Mock).mock.calls[0][0];
  expect(saved.data[0].timeSlotId).toBe('p2');
  expect(saved.skipDuplicates).toBeUndefined();
  expect(prisma.timetable.deleteMany).not.toHaveBeenCalled();
  expect(prisma.timetableEntry.deleteMany).not.toHaveBeenCalled();
});
test('existing intervals block overlapping periods even with different slot IDs', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    oldEntry({ timeSlotId: 'legacy', timeSlot: { startTime: '09:30', endTime: '10:30' } }),
  ]);
  await new SchedulerService().generate(input);
  expect((prisma.timetableEntry.createMany as jest.Mock).mock.calls[0][0].data[0].timeSlotId).toBe(
    'p3'
  );
});
test('repeated generation does not duplicate fully scheduled teaching', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    oldEntry({ courseOfferingId: 'it-offering' }),
  ]);
  await expect(new SchedulerService().generate(input)).rejects.toThrow('already scheduled');
  expect(prisma.timetable.create).not.toHaveBeenCalled();
  expect(prisma.timetableEntry.createMany).not.toHaveBeenCalled();
});
test('partial timetable resumes only missing sessions without replacing earlier rows', async () => {
  ctx.requests.push({ ...ctx.requests[0], id: 'second-hour' });
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    oldEntry({ courseOfferingId: 'it-offering' }),
  ]);
  (prisma.timetable.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-it' });
  const result = await new SchedulerService().generate(input);
  const saved = (prisma.timetableEntry.createMany as jest.Mock).mock.calls[0][0].data;
  expect(saved).toHaveLength(1);
  expect(saved[0].timetableId).toBe('existing-it');
  expect(result.metadata).toEqual(
    expect.objectContaining({ preservedSessions: 1, assignedSessions: 2 })
  );
  expect(prisma.timetable.create).not.toHaveBeenCalled();
});
test('simultaneous write is rejected before any planning or database changes', async () => {
  (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ acquired: false }]);
  await expect(new SchedulerService().generate(input)).rejects.toThrow('Another timetable');
  expect(prisma.semester.findUnique).not.toHaveBeenCalled();
  expect(prisma.timetableEntry.createMany).not.toHaveBeenCalled();
});
test('wrong academic year fails before bookings are changed', async () => {
  await expect(
    new SchedulerService().generate({ ...input, academicYearId: 'wrong' })
  ).rejects.toThrow('academic year');
  expect(prisma.timetable.create).not.toHaveBeenCalled();
});

test.each([false, true])(
  'slow scheduling runs outside transactions (genetic: %s)',
  async (useGenetic) => {
    let now = 0;
    let transactionOpen = false;
    const durations: number[] = [];
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    (prisma.$transaction as jest.Mock).mockImplementation(async (work, options) => {
      const startedAt = now;
      transactionOpen = true;
      try {
        const result = await work(prisma);
        const duration = now - startedAt;
        durations.push(duration);
        if (duration > options.timeout) throw new Error('Transaction already closed');
        return result;
      } finally {
        transactionOpen = false;
      }
    });
    const run = schedulingEngine.run.bind(schedulingEngine);
    jest.spyOn(schedulingEngine, 'run').mockImplementation((context) => {
      expect(transactionOpen).toBe(false);
      now += 160_000;
      return run(context);
    });
    jest.spyOn(geneticOptimizer, 'optimize').mockImplementation((_context, seed) => {
      expect(transactionOpen).toBe(false);
      now += 160_000;
      return seed;
    });
    (prisma.timetableEntry.createMany as jest.Mock).mockImplementation(async () => {
      expect(transactionOpen).toBe(true);
      return { count: 1 };
    });

    await expect(new SchedulerService().generate({ ...input, useGenetic })).resolves.toMatchObject({
      id: 'new-it',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(durations).toEqual([0, 0]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(geneticOptimizer.optimize).toHaveBeenCalledTimes(useGenetic ? 1 : 0);
  }
);

test('a booking changed while planning rejects the stale result before any insert', async () => {
  (prisma.timetableEntry.findMany as jest.Mock)
    .mockResolvedValueOnce([oldEntry()])
    .mockResolvedValueOnce([
      oldEntry({ timeSlotId: 'p2', timeSlot: { startTime: '10:00', endTime: '11:00' } }),
    ]);

  await expect(new SchedulerService().generate(input)).rejects.toThrow('changed during generation');
  expect(prisma.timetable.findFirst).not.toHaveBeenCalled();
  expect(prisma.timetable.create).not.toHaveBeenCalled();
  expect(prisma.timetableEntry.createMany).not.toHaveBeenCalled();
});

test('another generation completing this scope prevents duplicate teaching', async () => {
  (prisma.timetableEntry.findMany as jest.Mock)
    .mockResolvedValueOnce([oldEntry()])
    .mockResolvedValueOnce([
      oldEntry(),
      oldEntry({ id: 'new-booking', courseOfferingId: 'it-offering' }),
    ]);

  await expect(new SchedulerService().generate(input)).rejects.toThrow('already scheduled');
  expect(prisma.timetableEntry.createMany).not.toHaveBeenCalled();
});

test.each(['room capacity', 'faculty availability', 'weekly workload', 'teaching requirements'])(
  'changed %s invalidates the plan',
  async (change) => {
    const changed = structuredClone(ctx);
    if (change === 'room capacity') changed.rooms[0].capacity = 10;
    if (change === 'faculty availability') changed.facultyAvailability.set('it-teacher', new Set());
    if (change === 'weekly workload') changed.facultyMaxPerWeek.set('it-teacher', 1);
    if (change === 'teaching requirements')
      changed.requests.push({ ...changed.requests[0], id: 'extra' });
    (SchedulerService.prototype as any).buildContext
      .mockResolvedValueOnce(structuredClone(ctx))
      .mockResolvedValueOnce(changed);

    await expect(new SchedulerService().generate(input)).rejects.toThrow(
      'changed during generation'
    );
    expect(prisma.timetableEntry.createMany).not.toHaveBeenCalled();
  }
);

test('save must reacquire the scheduling lock after planning', async () => {
  (prisma.$queryRaw as jest.Mock)
    .mockResolvedValueOnce([{ acquired: true }])
    .mockResolvedValueOnce([{ acquired: false }]);

  await expect(new SchedulerService().generate(input)).rejects.toThrow('Another timetable');
  expect(prisma.timetableEntry.createMany).not.toHaveBeenCalled();
});
