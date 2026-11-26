import { SchedulingEngine } from '../modules/scheduler/scheduler.engine';
import { EngineContext, SessionRequest } from '../modules/scheduler/scheduler.types';
import { geneticOptimizer } from '../modules/scheduler/scheduler.genetic';

function context(isLab = false, sectionId: string | null = null): EngineContext {
  const request: SessionRequest = {
    id: 'req',
    courseOfferingId: 'offering',
    subjectId: 'subject',
    subjectCode: 'DB',
    subjectName: 'Database',
    subjectType: isLab ? 'LAB' : 'THEORY',
    difficulty: 'EASY',
    facultyId: 'faculty',
    sectionId,
    practicalBatchId: sectionId ? 'batch' : null,
    departmentId: 'depstars-ce',
    isLab,
    consecutiveSlots: isLab ? 2 : 1,
    requiredCapacity: 20,
    priority: 100,
  };
  return {
    requests: [request],
    workingDays: [{ id: 'mon', order: 1, name: 'MONDAY' }],
    timeSlots: [1, 2].map((order) => ({
      id: 'p' + order,
      order,
      name: 'Period ' + order,
      isLunchBreak: false,
      durationMins: 60,
    })),
    rooms: [
      { id: 'cspit-shared', capacity: 60, departmentId: null, instituteId: 'cspit', code: 'C1' },
      {
        id: 'depstars-shared',
        capacity: 60,
        departmentId: null,
        instituteId: 'depstars',
        code: 'D1',
      },
    ],
    laboratories: [
      { id: 'cspit-lab', capacity: 60, departmentId: 'cspit-ce', instituteId: 'cspit', code: 'CL' },
      {
        id: 'depstars-lab',
        capacity: 60,
        departmentId: 'depstars-ce',
        instituteId: 'depstars',
        code: 'DL',
      },
    ],
    facultyAvailability: new Map(),
    facultyPreferences: new Map(),
    facultyMaxPerDay: new Map([['faculty', 8]]),
    facultyMaxPerWeek: new Map([['faculty', 30]]),
    softConstraints: [],
    maxIterations: 100,
    departmentCodes: new Map([
      ['depstars-ce', 'CE'],
      ['cspit-ce', 'CE'],
    ]),
    departmentInstitutes: new Map([
      ['depstars-ce', 'depstars'],
      ['cspit-ce', 'cspit'],
    ]),
  };
}

describe('Institute resource isolation', () => {
  test('shared classrooms stay within the batch institute', () => {
    const result = new SchedulingEngine().run(context());
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].roomId).toBe('depstars-shared');
  });
  test.each([null, 'section'])(
    'lab scheduling stays within the institute (section %s)',
    (section) => {
      const result = new SchedulingEngine().run(context(true, section));
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].laboratoryId).toBe('depstars-lab');
    }
  );
  test('does not fall back to another institute when local rooms are unavailable', () => {
    const ctx = context();
    ctx.rooms = ctx.rooms.filter((r) => r.instituteId === 'cspit');
    const result = new SchedulingEngine().run(ctx);
    expect(result.assignments).toHaveLength(0);
    expect(result.unassigned).toHaveLength(1);
  });
  test('unowned rooms are excluded', () => {
    const ctx = context();
    ctx.rooms = [{ ...ctx.rooms[1], instituteId: null }];
    expect(new SchedulingEngine().run(ctx).assignments).toHaveLength(0);
  });
  test('genetic optimization preserves institute ownership', () => {
    const ctx = context();
    const seed = new SchedulingEngine().run(ctx);
    const result = geneticOptimizer.optimize(ctx, seed, 4, 1, 3);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments.every((a) => a.roomId === 'depstars-shared')).toBe(true);
  });
});

test.each([false, true])('generation enforces equipment and room type (lab %s)', (isLab) => {
  const ctx = context(isLab, 'section');
  ctx.requests[0].venueRequirements = [{ equipment: 'oscilloscope', roomTypeId: 'electrical' }];
  const denied = new SchedulingEngine().run(ctx);
  expect(denied.assignments).toHaveLength(0);
  if (isLab)
    Object.assign(ctx.laboratories[1], { equipment: 'Oscilloscope', roomTypeId: 'electrical' });
  else Object.assign(ctx.rooms[1], { equipment: 'Oscilloscope', roomTypeId: 'electrical' });
  expect(new SchedulingEngine().run(ctx).assignments).toHaveLength(1);
});
test.each([false, true])(
  'generation cannot place teaching when all dated occurrences are cancelled (lab %s)',
  (isLab) => {
    const ctx = context(isLab, 'section');
    ctx.facultyTeachingDays = new Map([['faculty', new Set<string>()]]);
    expect(new SchedulingEngine().run(ctx).assignments).toHaveLength(0);
  }
);
