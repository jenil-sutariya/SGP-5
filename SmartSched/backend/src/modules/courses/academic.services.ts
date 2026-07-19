import prisma from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../utils/AppError';
import { getPagination, buildSearchFilter, PaginationQuery } from '../../utils/pagination';

// ─── Course Service ───────────────────────────────────────────────────────────

export class CourseService {
  async list(query: PaginationQuery & { departmentId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.instituteId  ? { department: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          department: true,
          program: true,
          courseSubjects: { include: { subject: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        department: true,
        program: true,
        courseSubjects: { include: { subject: true } },
        courseOfferings: { include: { subject: true, semester: true, section: true } },
      },
    });
    if (!course) throw new NotFoundError('Course');
    return course;
  }

  async create(data: {
    code: string;
    name: string;
    description?: string;
    departmentId: string;
    programId?: string | null;
    semesterNo: number;
    totalCredits?: number;
    subjectIds?: string[];
  }) {
    if (await prisma.course.findUnique({ where: { code: data.code } })) {
      throw new ConflictError('Course code already exists');
    }
    const { subjectIds, ...courseData } = data;
    return prisma.course.create({
      data: {
        ...courseData,
        ...(subjectIds?.length
          ? { courseSubjects: { create: subjectIds.map((subjectId) => ({ subjectId })) } }
          : {}),
      },
      include: { courseSubjects: { include: { subject: true } } },
    });
  }

  async update(id: string, data: Record<string, unknown> & { subjectIds?: string[] }) {
    await this.getById(id);
    const { subjectIds, ...rest } = data;
    if (subjectIds) {
      await prisma.courseSubject.deleteMany({ where: { courseId: id } });
      if (subjectIds.length > 0) {
        await prisma.courseSubject.createMany({
          data: subjectIds.map((subjectId) => ({ courseId: id, subjectId })),
        });
      }
      // Auto-recalculate totalCredits from assigned subjects
      const subjects = await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { credits: true },
      });
      const totalCredits = subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0);
      rest.totalCredits = totalCredits;
    }
    return prisma.course.update({
      where: { id },
      data: rest,
      include: { courseSubjects: { include: { subject: true } } },
    });
  }

  async listOfferings(instituteId?: string) {
    const where = {
      ...(instituteId ? { course: { department: { instituteId } } } : {}),
    };
    return prisma.courseOffering.findMany({
      where,
      include: {
        course: { include: { department: true } },
        subject: { include: { department: true } },
        semester: true,
        section: true,
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.course.delete({ where: { id } });
    return { message: 'Course deleted' };
  }
}

// ─── Academic (Year / Semester / Meta) Service ────────────────────────────────

export class AcademicService {
  async listYears(query: PaginationQuery) {
    const { page, limit, skip, sortBy, sortOrder } = getPagination(query);
    const [data, total] = await Promise.all([
      prisma.academicYear.findMany({
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { semesters: true, _count: { select: { holidays: true } } },
      }),
      prisma.academicYear.count(),
    ]);
    return { data, total, page, limit };
  }

  async createYear(data: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean }) {
    if (data.isCurrent) {
      await prisma.academicYear.updateMany({ data: { isCurrent: false } });
    }
    return prisma.academicYear.create({ data });
  }

  async updateYear(id: string, data: Partial<{ name: string; startDate: Date; endDate: Date; isCurrent: boolean; isActive: boolean }>) {
    const year = await prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundError('Academic year');
    if (data.isCurrent) {
      await prisma.academicYear.updateMany({ data: { isCurrent: false } });
    }
    return prisma.academicYear.update({ where: { id }, data });
  }

  async deleteYear(id: string) {
    await prisma.academicYear.delete({ where: { id } });
    return { message: 'Academic year deleted' };
  }

  async listSemesters(query: PaginationQuery & { academicYearId?: string }) {
    const { page, limit, skip, sortBy, sortOrder } = getPagination(query);
    const where = query.academicYearId ? { academicYearId: query.academicYearId } : {};
    const [data, total] = await Promise.all([
      prisma.semester.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { academicYear: true },
      }),
      prisma.semester.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async createSemester(data: {
    name: string;
    number: number;
    academicYearId: string;
    startDate: Date;
    endDate: Date;
    isCurrent?: boolean;
  }) {
    if (data.isCurrent) {
      await prisma.semester.updateMany({ data: { isCurrent: false } });
    }
    return prisma.semester.create({ data, include: { academicYear: true } });
  }

  async updateSemester(id: string, data: Record<string, unknown>) {
    const sem = await prisma.semester.findUnique({ where: { id } });
    if (!sem) throw new NotFoundError('Semester');
    if (data.isCurrent) {
      await prisma.semester.updateMany({ data: { isCurrent: false } });
    }
    return prisma.semester.update({ where: { id }, data, include: { academicYear: true } });
  }

  async deleteSemester(id: string) {
    await prisma.semester.delete({ where: { id } });
    return { message: 'Semester deleted' };
  }

  async listDays(instituteId?: string) {
    return prisma.day.findMany({
      where: {
        isWorking: true,
        OR: [
          ...(instituteId ? [{ instituteId }] : []),
          { instituteId: null }
        ]
      },
      orderBy: { order: 'asc' }
    });
  }

  async listTimeSlots(instituteId?: string) {
    return prisma.timeSlot.findMany({
      where: {
        isActive: true,
        OR: [
          ...(instituteId ? [{ instituteId }] : []),
          { instituteId: null }
        ]
      },
      orderBy: { order: 'asc' }
    });
  }
}

export const courseService  = new CourseService();
export const academicService = new AcademicService();
