import { Prisma } from '@prisma/client';
import prisma from '../../database/prisma';
import { ConflictError, ValidationError } from '../../utils/AppError';

// Timetable entry/status writes and generation snapshot/save phases use this lock.
// Never run the scheduling engine or genetic optimization inside this transaction.
// It is transaction-scoped, so PostgreSQL releases it on commit, rollback or disconnect.
export async function withScheduleWrite<T>(
  work: (db: Prisma.TransactionClient) => Promise<T>,
  instituteId?: string
): Promise<T> {
  return prisma.$transaction(
    async (db) => {
      const [lock] = instituteId
        ? await db.$queryRaw<
            { acquired: boolean }[]
          >`SELECT (pg_try_advisory_xact_lock_shared(82451627) AND pg_try_advisory_xact_lock(82451627, hashtext(${instituteId}))) AS acquired`
        : await db.$queryRaw<
            { acquired: boolean }[]
          >`SELECT pg_try_advisory_xact_lock(82451627) AS acquired`;
      if (!lock.acquired)
        throw new ConflictError(
          'Another timetable is being saved or generated. Please retry after it finishes.'
        );
      return work(db);
    },
    {
      maxWait: 5000,
      timeout: 120000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );
}

export function minutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new ValidationError('Time slots must use valid 24-hour times');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function overlaps(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
) {
  return minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);
}

export function activeBookingWhere(semester: {
  startDate: Date;
  endDate: Date;
}): Prisma.TimetableWhereInput {
  return {
    status: { in: ['GENERATED', 'PUBLISHED'] },
    semester: { startDate: { lte: semester.endDate }, endDate: { gte: semester.startDate } },
  };
}
