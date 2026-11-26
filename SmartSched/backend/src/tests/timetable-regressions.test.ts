import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockDetectAndPersist = jest.fn().mockResolvedValue([]);
jest.mock('../modules/timetable/conflict.service', () => ({
  ConflictService: jest
    .fn()
    .mockImplementation(() => ({ detectAndPersist: mockDetectAndPersist })),
}));

jest.mock('../database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn() },
    department: { findUnique: jest.fn() },
    subject: { findUnique: jest.fn(), delete: jest.fn() },
    timetable: { findFirst: jest.fn() },
    timetableEntry: { findMany: jest.fn(), deleteMany: jest.fn() },
  },
}));

import prisma from '../database/prisma';
import { config } from '../config';
import { errorHandler } from '../middlewares/errorHandler';
import { subjectRouter } from '../modules/subjects/subjects.routes';
import { TimetableAccess } from '../modules/timetable/timetable.access';
import { TimetableService } from '../modules/timetable/timetable.service';

describe('Timetable and route regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ acquired: true }]);
  });

  test('DELETE /subjects/:id without a request body succeeds', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@charusat.edu.in',
      isActive: true,
      departmentId: null,
      instituteId: 'depstar',
      role: { name: 'INSTITUTE_ADMIN' },
    });
    (prisma.subject.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      departmentId: 'dept-1',
      department: { instituteId: 'depstar' },
      requirements: [],
    });
    (prisma.department.findUnique as jest.Mock).mockResolvedValue({
      id: 'dept-1',
      instituteId: 'depstar',
    });
    (prisma.subject.delete as jest.Mock).mockResolvedValue({ id: 'sub-1' });

    const app = express();
    app.use(express.json());
    app.use('/subjects', subjectRouter);
    app.use(errorHandler);

    const token = jwt.sign(
      { userId: 'admin-1', email: 'admin@charusat.edu.in', role: 'INSTITUTE_ADMIN' },
      config.jwt.accessSecret
    );

    const res = await request(app)
      .delete('/subjects/sub-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
  });

  test('deleteSession refreshes conflict records and uses institute lock', async () => {
    const access = await TimetableAccess.forUser({
      id: 'mgr-1',
      email: 'mgr@charusat.edu.in',
      role: 'INSTITUTE_ADMIN',
      instituteId: 'depstar',
    });
    (prisma.timetable.findFirst as jest.Mock).mockResolvedValue({
      id: 'tt-1',
      instituteId: 'depstar',
      departmentId: null,
      status: 'GENERATED',
      entries: [],
      conflicts: [],
    });
    (prisma.timetableEntry.findMany as jest.Mock).mockResolvedValue([
      { id: 'e1', isLocked: false },
      { id: 'e2', isLocked: false },
    ]);
    (prisma.timetableEntry.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

    const result = await new TimetableService(prisma as never, access).deleteSession(
      'tt-1',
      'sess-1'
    );

    expect(result).toEqual({ message: 'Whole teaching session deleted', deletedPeriods: 2 });
    expect(prisma.timetableEntry.deleteMany).toHaveBeenCalledWith({
      where: { timetableId: 'tt-1', sessionId: 'sess-1' },
    });
    expect(mockDetectAndPersist).toHaveBeenCalledWith('tt-1');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sqlStrings = (prisma.$queryRaw as jest.Mock).mock.calls[0][0].join(' ');
    expect(sqlStrings).toContain('pg_try_advisory_xact_lock_shared');
    expect(sqlStrings).toContain('hashtext');
  });
});
