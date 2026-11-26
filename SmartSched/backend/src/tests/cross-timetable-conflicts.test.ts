jest.mock('../database/prisma', () => ({
  __esModule: true,
  default: {
    holiday: { findMany: jest.fn() },
    facultyLeave: { findMany: jest.fn() },
    timetable: { findUnique: jest.fn() },
    timetableEntry: { findMany: jest.fn() },
    facultyAvailability: { findMany: jest.fn() },
    facultyPreference: { findMany: jest.fn() },
  },
}));
import prisma from '../database/prisma';
import { ConflictService } from '../modules/timetable/conflict.service';
const term = { startDate: new Date('2026-07-01'), endDate: new Date('2026-12-31') };
const entry = (id: string, timetableId: string, changes = {}) => ({
  id,
  timetableId,
  facultyId: id + '-faculty',
  roomId: 'shared',
  laboratoryId: null,
  sectionId: id + '-section',
  practicalBatchId: null,
  isLab: false,
  dayId: 'mon',
  timeSlotId: id + '-period',
  day: { name: 'MONDAY', isWorking: true },
  timeSlot: { startTime: '09:00', endTime: '10:00', isLunchBreak: false, isActive: true },
  room: { code: 'D101', capacity: 60 },
  laboratory: null,
  section: { code: id, capacity: 40 },
  practicalBatch: null,
  faculty: { maxHoursPerDay: 8, maxHoursPerWeek: 20, user: { firstName: id } },
  courseOfferingId: id + '-offering',
  courseOffering: { maxStudents: 40, subject: { type: 'THEORY', weeklyHours: 1, code: id } },
  timetable: { semester: term },
  ...changes,
});
beforeEach(() => {
  jest.resetAllMocks();
  (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.facultyLeave.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.timetable.findUnique as jest.Mock).mockResolvedValue({ semester: term });
  (prisma.facultyAvailability.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.facultyPreference.findMany as jest.Mock).mockResolvedValue([]);
});
test('detects another timetable booking by time interval, not slot identity', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    entry('it', 'target'),
    entry('cse', 'existing'),
  ]);
  const result = await new ConflictService().detect('target');
  expect(result).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'ROOM_CLASH', entryIds: ['it', 'cse'] }),
    ])
  );
});
test('adjacent periods do not clash', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    entry('it', 'target'),
    entry('cse', 'existing', {
      timeSlot: { startTime: '10:00', endTime: '11:00', isLunchBreak: false, isActive: true },
    }),
  ]);
  expect(await new ConflictService().detect('target')).toEqual([]);
});
test('separate institutes with separate assets do not clash', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    entry('it', 'target'),
    entry('cspit', 'existing', { roomId: 'cspit-room' }),
  ]);
  expect(await new ConflictService().detect('target')).toEqual([]);
});
test('shared faculty workload is counted across departments', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    entry('it', 'target', {
      facultyId: 'professor',
      faculty: { user: { firstName: 'Prof' }, maxHoursPerDay: 1, maxHoursPerWeek: 1 },
    }),
    entry('cse', 'existing', {
      facultyId: 'professor',
      roomId: 'other',
      timeSlot: { startTime: '10:00', endTime: '11:00', isLunchBreak: false, isActive: true },
    }),
  ]);
  const types = (await new ConflictService().detect('target')).map((c) => c.type);
  expect(types).toContain('FACULTY_DAILY_OVERLOAD');
  expect(types).toContain('FACULTY_WEEKLY_OVERLOAD');
});
test('half a laboratory session is rejected', async () => {
  (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
    entry('lab', 'target', {
      isLab: true,
      roomId: null,
      room: null,
      laboratoryId: 'lab',
      laboratory: { capacity: 60 },
      courseOffering: { maxStudents: 40, subject: { type: 'LAB', labHours: 2, code: 'LAB' } },
    }),
  ]);
  expect((await new ConflictService().detect('target')).map((c) => c.type)).toContain(
    'INCOMPLETE_SESSION'
  );
});
