import { TimetableAccess } from '../timetable/timetable.access';
import { Prisma } from '@prisma/client';
import prisma from '../../database/prisma';

export class AnalyticsService {
  async getDashboard(instituteId: string | undefined, userId: string, access?: TimetableAccess) {
    const timetableWhere: Prisma.TimetableWhereInput = {
      AND: [access?.timetableWhere || {}, instituteId ? { instituteId } : {}],
    };
    const [
      facultyCount,
      studentCount,
      departmentCount,
      courseCount,
      roomCount,
      timetableStats,
      notifications,
      labCount,
      sectionCount,
      recentTimetables,
      unresolvedConflicts,
    ] = await Promise.all([
      prisma.faculty.count({
        where: {
          isActive: true,
          ...(instituteId ? { department: { instituteId } } : {}),
        },
      }),
      prisma.student.count({
        where: {
          isActive: true,
          ...(instituteId ? { department: { instituteId } } : {}),
        },
      }),
      prisma.department.count({
        where: {
          isActive: true,
          ...(instituteId ? { instituteId } : {}),
        },
      }),
      prisma.course.count({
        where: {
          isActive: true,
          ...(instituteId ? { department: { instituteId } } : {}),
        },
      }),
      prisma.room.count({
        where: {
          isActive: true,
          ...(instituteId ? { building: { instituteId } } : {}),
        },
      }),
      prisma.timetable.groupBy({
        by: ['status'],
        where: timetableWhere,
        _count: true,
      }),
      prisma.notification.findMany({
        take: 4,
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.laboratory.count({
        where: {
          isActive: true,
          ...(instituteId ? { department: { instituteId }, building: { instituteId } } : {}),
        },
      }),
      prisma.section.count({
        where: { isActive: true, ...(instituteId ? { department: { instituteId } } : {}) },
      }),
      prisma.timetable.findMany({
        where: timetableWhere,
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          semester: { select: { name: true } },
          department: { select: { code: true } },
          _count: {
            select: {
              entries: { where: access?.entryWhere },
              conflicts: {
                where: { resolved: false, ...(access?.restricted ? { id: { in: [] } } : {}) },
              },
            },
          },
        },
      }),
      access?.restricted
        ? Promise.resolve(0)
        : prisma.timetableConflict.count({
            where: {
              resolved: false,
              timetable: { AND: [timetableWhere], status: { in: ['GENERATED', 'PUBLISHED'] } },
            },
          }),
    ]);
    return {
      stats: {
        facultyCount,
        studentCount,
        departmentCount,
        courseCount,
        roomCount,
        labCount,
        sectionCount,
        unresolvedConflicts,
      },
      recentTimetables,
      timetableStatus: timetableStats.map((t) => ({ status: t.status, count: t._count })),
      notifications,
    };
  }

  async getRoomUtilization(instituteId?: string) {
    const rooms = await prisma.room.findMany({
      where: {
        isActive: true,
        ...(instituteId ? { building: { instituteId } } : {}),
      },
      include: { _count: { select: { timetableEntries: true } } },
      take: 50,
    });
    return rooms.map((r) => ({
      room: r.code,
      name: r.name,
      capacity: r.capacity,
      bookings: r._count.timetableEntries,
      utilization: Math.min(100, Math.round((r._count.timetableEntries / 40) * 100)),
    }));
  }

  async getFacultyWorkload(instituteId?: string) {
    const faculty = await prisma.faculty.findMany({
      where: {
        isActive: true,
        ...(instituteId ? { department: { instituteId } } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { timetableEntries: true } },
      },
      take: 50,
    });
    return faculty.map((f) => ({
      id: f.id,
      name: `${f.user.firstName} ${f.user.lastName}`,
      maxHours: f.maxHoursPerWeek,
      assigned: f._count.timetableEntries,
      loadPercent: Math.round((f._count.timetableEntries / f.maxHoursPerWeek) * 100),
    }));
  }

  async getTimetableStatus(instituteId?: string, access?: TimetableAccess) {
    const stats = await prisma.timetable.groupBy({
      by: ['status'],
      where: {
        AND: [access?.timetableWhere || {}, instituteId ? { instituteId } : {}],
      },
      _count: true,
    });
    return stats.map((s) => ({ status: s.status, count: s._count }));
  }
}

export const analyticsService = new AnalyticsService();
