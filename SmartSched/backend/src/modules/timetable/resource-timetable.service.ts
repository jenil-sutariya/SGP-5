import { datedWeekOccurrences } from './occurrence.rules';
import { Prisma } from '@prisma/client';
import prisma from '../../database/prisma';
import { AuthRequest } from '../../middlewares/auth';
import { ForbiddenError, NotFoundError } from '../../utils/AppError';

export class ResourceTimetableService {
  constructor(private db: Prisma.TransactionClient = prisma) {}

  async get(
    kind: 'room' | 'lab',
    id: string,
    user: AuthRequest['user'],
    semesterId?: string,
    requestedWeek?: string
  ) {
    if (
      !user ||
      !['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD', 'SCHEDULER'].includes(user.role)
    ) {
      throw new ForbiddenError();
    }
    const include = {
      building: {
        select: {
          name: true,
          instituteId: true,
          institute: { select: { name: true, code: true } },
        },
      },
      department: { select: { code: true, instituteId: true } },
    } as const;
    const resource =
      kind === 'room'
        ? await this.db.room.findUnique({ where: { id }, include })
        : await this.db.laboratory.findUnique({ where: { id }, include });
    if (!resource) throw new NotFoundError(kind === 'room' ? 'Classroom' : 'Laboratory');
    const instituteId = resource.building.instituteId;
    if (
      user.role !== 'ADMIN' &&
      (!user.instituteId ||
        instituteId !== user.instituteId ||
        (resource.department && resource.department.instituteId !== user.instituteId))
    ) {
      throw new ForbiddenError('You can only view resources belonging to your institute');
    }
    const semesters = await this.db.semester.findMany({
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
        academicYear: { select: { name: true } },
      },
    });
    const semester = semesterId ? semesters.find((item) => item.id === semesterId) : semesters[0];
    if (semesterId && !semester) throw new NotFoundError('Semester');
    const entries = semester
      ? await this.db.timetableEntry.findMany({
          where: {
            ...(kind === 'room' ? { roomId: id } : { laboratoryId: id }),
            timetable: {
              ...(instituteId ? { instituteId } : {}),
              status: { in: ['GENERATED', 'PUBLISHED'] },
              semester: {
                startDate: { lte: semester.endDate },
                endDate: { gte: semester.startDate },
              },
            },
          },
          select: {
            id: true,
            facultyId: true,
            day: { select: { name: true, shortName: true, order: true } },
            timeSlot: { select: { startTime: true, endTime: true, isLunchBreak: true } },
            courseOffering: { select: { subject: { select: { name: true, code: true } } } },
            faculty: { select: { user: { select: { firstName: true, lastName: true } } } },
            section: { select: { name: true, code: true, department: { select: { code: true } } } },
            practicalBatch: { select: { name: true } },
            timetable: {
              select: {
                id: true,
                name: true,
                instituteId: true,
                academicYearId: true,
                status: true,
                semester: { select: { name: true, startDate: true, endDate: true } },
              },
            },
          },
          orderBy: [{ day: { order: 'asc' } }, { timeSlot: { startTime: 'asc' } }],
        })
      : [];
    const calendarScope = instituteId
      ? { OR: [{ instituteId }, { instituteId: null }] }
      : { instituteId: null };
    const [days, timeSlots] = await Promise.all([
      this.db.day.findMany({
        where: { isWorking: true, ...calendarScope },
        select: { name: true, shortName: true, order: true },
        orderBy: { order: 'asc' },
      }),
      this.db.timeSlot.findMany({
        where: { isActive: true, ...calendarScope },
        select: { startTime: true, endTime: true, isLunchBreak: true },
        orderBy: { order: 'asc' },
      }),
    ]);
    let week: string | undefined;
    let displayEntries: ((typeof entries)[number] & {
      date?: string;
      cancellationReason?: string | null;
    })[] = entries;
    if (requestedWeek && semester) {
      const dated = await datedWeekOccurrences(
        this.db,
        instituteId,
        semester,
        entries,
        requestedWeek,
        (entry) => entry.timetable
      );
      week = dated.week;
      displayEntries = dated.entries;
    }
    return {
      week,
      resource: {
        id: resource.id,
        code: resource.code,
        name: resource.name,
        capacity: resource.capacity,
        building: resource.building.name,
        institute: resource.building.institute,
        kind,
      },
      semesters,
      selectedSemesterId: semester?.id ?? null,
      entries: displayEntries,
      days,
      timeSlots,
    };
  }
}
export const resourceTimetableService = new ResourceTimetableService();
