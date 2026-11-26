jest.mock('../database/prisma', () => ({
  __esModule: true,
  default: Object.fromEntries(
    [
      'faculty',
      'student',
      'department',
      'course',
      'room',
      'laboratory',
      'section',
      'timetable',
      'timetableConflict',
      'notification',
    ].map((name) => [name, { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() }])
  ),
}));
import prisma from '../database/prisma';
import { analyticsService } from '../modules/analytics/analytics.service';

beforeEach(() => {
  jest.resetAllMocks();
  for (const model of Object.values(prisma)) {
    if (model && typeof model === 'object' && 'count' in model) {
      (model.count as jest.Mock).mockResolvedValue(0);
      (model.findMany as jest.Mock).mockResolvedValue([]);
    }
  }
  (prisma.timetable.groupBy as jest.Mock).mockResolvedValue([]);
});

test('dashboard scopes resources and timetable summaries to DEPSTAR', async () => {
  (prisma.laboratory.count as jest.Mock).mockResolvedValue(3);
  const result = await analyticsService.getDashboard('depstar', 'user-1');
  expect(result.stats.labCount).toBe(3);
  expect(prisma.room.count).toHaveBeenCalledWith({
    where: { isActive: true, building: { instituteId: 'depstar' } },
  });
  const scope = (prisma.timetable.groupBy as jest.Mock).mock.calls[0][0].where;
  expect(scope.AND).toContainEqual({ instituteId: 'depstar' });
  expect(prisma.timetable.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
  expect(prisma.timetableConflict.count).toHaveBeenCalledWith({
    where: {
      resolved: false,
      timetable: { AND: [scope], status: { in: ['GENERATED', 'PUBLISHED'] } },
    },
  });
});

test('all-institute overview still fetches only the current users unread notifications', async () => {
  await analyticsService.getDashboard(undefined, 'admin-1');
  expect(prisma.notification.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: 'admin-1', isRead: false } })
  );
  expect(prisma.timetable.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({ where: { AND: [{}, {}] } })
  );
});

test('empty database returns empty lists and real zero counts', async () => {
  const result = await analyticsService.getDashboard('cspit', 'user-2');
  expect(result.stats.unresolvedConflicts).toBe(0);
  expect(result.stats.roomCount).toBe(0);
  expect(result.recentTimetables).toEqual([]);
  expect(result.timetableStatus).toEqual([]);
  expect(result.notifications).toEqual([]);
});

test('room utilization scopes rooms through building instituteId', async () => {
  (prisma.room.findMany as jest.Mock).mockResolvedValue([
    { code: 'D101', name: 'Room 101', capacity: 60, _count: { timetableEntries: 4 } },
  ]);
  const result = await analyticsService.getRoomUtilization('depstar');
  expect(prisma.room.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { isActive: true, building: { instituteId: 'depstar' } },
    })
  );
  expect(result).toEqual([
    { room: 'D101', name: 'Room 101', capacity: 60, bookings: 4, utilization: 10 },
  ]);
});
