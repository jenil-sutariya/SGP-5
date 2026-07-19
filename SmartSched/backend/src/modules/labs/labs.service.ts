import prisma from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../utils/AppError';
import { getPagination, buildSearchFilter, PaginationQuery } from '../../utils/pagination';

export class LabService {
  async list(query: PaginationQuery & { departmentId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.instituteId  ? { department: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.laboratory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { building: true, department: true },
      }),
      prisma.laboratory.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const lab = await prisma.laboratory.findUnique({
      where: { id },
      include: { building: true, department: true },
    });
    if (!lab) throw new NotFoundError('Laboratory');
    return lab;
  }

  async create(data: Parameters<typeof prisma.laboratory.create>[0]['data']) {
    if (await prisma.laboratory.findUnique({ where: { code: data.code as string } })) {
      throw new ConflictError('Lab code already exists');
    }
    return prisma.laboratory.create({ data, include: { building: true, department: true } });
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    return prisma.laboratory.update({ where: { id }, data, include: { building: true, department: true } });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.laboratory.delete({ where: { id } });
    return { message: 'Laboratory deleted' };
  }
}

export const labService = new LabService();
