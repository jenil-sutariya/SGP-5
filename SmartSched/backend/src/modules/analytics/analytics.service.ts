import prisma from '../../database/prisma';

export class AnalyticsService {
  async getDashboard(instituteId?: string) {
    const [
      facultyCount,
      studentCount,
      departmentCount,
      courseCount,
      roomCount,
      timetableStats,
      recentLogs,
      notifications,
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
          ...(instituteId ? { instituteId } : {}),
        },
      }),
      prisma.timetable.groupBy({
        by: ['status'],
        where: {
          ...(instituteId ? { department: { instituteId } } : {}),
        },
        _count: true,
      }),
      prisma.auditLog.findMany({
        take: 10,
        where: {
          ...(instituteId ? { user: { instituteId } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.notification.findMany({
        take: 8,
        where: {
          ...(instituteId ? { user: { instituteId } } : {}),
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      stats: { facultyCount, studentCount, departmentCount, courseCount, roomCount },
      timetableStatus: timetableStats.map((t) => ({ status: t.status, count: t._count })),
      recentActivity: recentLogs,
      notifications,
    };
  }

  async getRoomUtilization(instituteId?: string) {
    const rooms = await prisma.room.findMany({
      where: {
        isActive: true,
        ...(instituteId ? { instituteId } : {}),
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

  async getTimetableStatus(instituteId?: string) {
    const stats = await prisma.timetable.groupBy({
      by: ['status'],
      where: {
        ...(instituteId ? { department: { instituteId } } : {}),
      },
      _count: true,
    });
    return stats.map((s) => ({ status: s.status, count: s._count }));
  }
}

export const analyticsService = new AnalyticsService();
