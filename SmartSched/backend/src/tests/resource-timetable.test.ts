import { Prisma, RoleName } from '@prisma/client';
import { ResourceTimetableService } from '../modules/timetable/resource-timetable.service';

const semester = {
  id: 'sem',
  name: 'Semester 5',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-12-31'),
  academicYear: { name: '2026-27' },
};
const owner = {
  id: 'admin',
  email: 'test@example.com',
  role: RoleName.INSTITUTE_ADMIN,
  instituteId: 'depstar',
};
function setup() {
  const resource = {
    id: 'r1',
    code: 'D101',
    name: 'Room 101',
    capacity: 60,
    building: {
      name: 'DEPSTAR',
      instituteId: 'depstar',
      institute: { name: 'DEPSTAR', code: 'DEPSTAR' },
    },
    department: null,
  };
  const db = {
    room: { findUnique: jest.fn().mockResolvedValue(resource) },
    laboratory: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ ...resource, department: { code: 'CSE', instituteId: 'depstar' } }),
    },
    semester: { findMany: jest.fn().mockResolvedValue([semester]) },
    timetableEntry: { findMany: jest.fn().mockResolvedValue([]) },
    day: { findMany: jest.fn().mockResolvedValue([]) },
    timeSlot: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { db, service: new ResourceTimetableService(db as unknown as Prisma.TransactionClient) };
}
test('room view includes generated and published bookings across departments and overlapping semesters', async () => {
  const { db, service } = setup();
  const data = await service.get('room', 'r1', owner);
  expect(data.selectedSemesterId).toBe('sem');
  expect(db.timetableEntry.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        roomId: 'r1',
        timetable: {
          instituteId: 'depstar',
          status: { in: ['GENERATED', 'PUBLISHED'] },
          semester: { startDate: { lte: semester.endDate }, endDate: { gte: semester.startDate } },
        },
      },
    })
  );
});
test('lab view selects laboratory bookings, not room bookings', async () => {
  const { db, service } = setup();
  await service.get('lab', 'r1', owner, 'sem');
  const where = db.timetableEntry.findMany.mock.calls[0][0].where;
  expect(where.laboratoryId).toBe('r1');
  expect(where.roomId).toBeUndefined();
});
test('institute admin cannot read another institutes resource', async () => {
  const { db, service } = setup();
  await expect(service.get('room', 'r1', { ...owner, instituteId: 'cspit' })).rejects.toThrow(
    'your institute'
  );
  expect(db.timetableEntry.findMany).not.toHaveBeenCalled();
});
test('non-global admin without institute is denied', async () => {
  const { service } = setup();
  await expect(service.get('room', 'r1', { ...owner, instituteId: null })).rejects.toThrow(
    'your institute'
  );
});
test('global admin can inspect resources from any institute', async () => {
  const { service } = setup();
  await expect(
    service.get('lab', 'r1', { ...owner, role: RoleName.ADMIN, instituteId: 'cspit' })
  ).resolves.toEqual(
    expect.objectContaining({ resource: expect.objectContaining({ kind: 'lab' }) })
  );
});
test('student cannot access the management view', async () => {
  const { db, service } = setup();
  await expect(service.get('room', 'r1', { ...owner, role: RoleName.STUDENT })).rejects.toThrow(
    'Forbidden'
  );
  expect(db.room.findUnique).not.toHaveBeenCalled();
});
test('unknown resource and semester have explicit not-found responses', async () => {
  const { db, service } = setup();
  await expect(service.get('room', 'r1', owner, 'missing')).rejects.toThrow('Semester not found');
  db.room.findUnique.mockResolvedValue(null);
  await expect(service.get('room', 'missing', owner)).rejects.toThrow('Classroom not found');
});
test('empty calendar and no semesters return an empty schedule', async () => {
  const { db, service } = setup();
  db.semester.findMany.mockResolvedValue([]);
  const data = await service.get('room', 'r1', owner);
  expect(data.entries).toEqual([]);
  expect(data.selectedSemesterId).toBeNull();
  expect(db.timetableEntry.findMany).not.toHaveBeenCalled();
});
