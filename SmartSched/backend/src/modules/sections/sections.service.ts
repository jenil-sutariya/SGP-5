import prisma from '../../database/prisma';
import { withScheduleWrite } from '../scheduler/scheduler.bookings';
import { ValidationError, ConflictError, NotFoundError } from '../../utils/AppError';
import { getPagination, buildSearchFilter, PaginationQuery } from '../../utils/pagination';

export class SectionService {
  async list(
    query: PaginationQuery & { departmentId?: string; semesterId?: string; instituteId?: string }
  ) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      ...(query.instituteId ? { department: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.section.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          department: true,
          program: true,
          semester: true,
          batch: true,
          _count: { select: { students: true } },
        },
      }),
      prisma.section.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        department: true,
        program: true,
        semester: true,
        batch: true,
        students: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!section) throw new NotFoundError('Section');
    return section;
  }

  async create(data: {
    name: string;
    code: string;
    departmentId: string;
    programId: string;
    semesterId: string;
    batchId?: string;
    capacity?: number;
    year: number;
  }) {
    const section = await prisma.section.create({
      data,
      include: { department: true, program: true, semester: true },
    });
    await this.autoCreateBatches(section.id, 20);
    return section;
  }

  async autoCreateBatches(sectionId: string, batchSize: number = 20) {
    if (!Number.isInteger(batchSize) || batchSize < 1)
      throw new ValidationError('Batch size must be a positive integer');
    const existing = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { department: { select: { instituteId: true } } },
    });
    if (!existing) throw new NotFoundError('Section');
    return withScheduleWrite(async (tx) => {
      const section = await tx.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new NotFoundError('Section');
      const count = Math.ceil(section.capacity / batchSize);
      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const letter = String.fromCharCode(65 + i);
        const code = section.code + '-' + letter;
        codes.push(code);
        const values = {
          name: 'Batch ' + letter,
          capacity: Math.min(batchSize, section.capacity - i * batchSize),
          isActive: true,
        };
        await tx.practicalBatch.upsert({
          where: { sectionId_code: { sectionId, code } },
          create: { sectionId, code, ...values },
          update: values,
        });
      }
      const obsolete = await tx.practicalBatch.findMany({
        where: { sectionId, code: { notIn: codes } },
        include: { _count: { select: { students: true, timetableEntries: true } } },
      });
      if (obsolete.some((batch) => batch._count.students || batch._count.timetableEntries))
        throw new ConflictError(
          'Move the students and scheduled sessions before removing a practical batch'
        );
      await tx.practicalBatch.deleteMany({
        where: { id: { in: obsolete.map((batch) => batch.id) } },
      });
      return tx.practicalBatch.findMany({ where: { sectionId } });
    }, existing.department.instituteId);
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    return prisma.section.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.section.delete({ where: { id } });
    return { message: 'Section deleted' };
  }
}

export const sectionService = new SectionService();
