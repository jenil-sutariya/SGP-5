import prisma from '../../database/prisma';
import { NotFoundError } from '../../utils/AppError';
import { getPagination, buildSearchFilter, PaginationQuery } from '../../utils/pagination';

export class SectionService {
  async list(query: PaginationQuery & { departmentId?: string; semesterId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.semesterId   ? { semesterId: query.semesterId }     : {}),
      ...(query.instituteId  ? { department: { instituteId: query.instituteId } } : {}),
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
        students: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
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
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });
    if (!section) throw new NotFoundError('Section');

    const capacity = section.capacity || 60;
    const numBatches = Math.ceil(capacity / batchSize);

    await prisma.practicalBatch.deleteMany({ where: { sectionId } });

    const batchesData = [];
    for (let i = 0; i < numBatches; i++) {
      const letter = String.fromCharCode(65 + i);
      batchesData.push({
        sectionId,
        name: `Batch ${letter}`,
        code: `${section.code}-${letter}`,
        capacity: batchSize,
      });
    }

    await prisma.practicalBatch.createMany({
      data: batchesData,
    });

    return prisma.practicalBatch.findMany({ where: { sectionId } });
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
