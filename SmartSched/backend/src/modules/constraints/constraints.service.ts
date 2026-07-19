import prisma from '../../database/prisma';
import { getPagination, buildSearchFilter } from '../../utils/pagination';

export class ConstraintsService {
  async list(query: Record<string, unknown>) {
    const { page, limit, skip, search } = getPagination(query);
    const where = buildSearchFilter(search, ['name', 'category']);
    const [data, total] = await Promise.all([
      prisma.constraint.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.constraint.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async create(data: any) {
    return prisma.constraint.create({ data: { ...data, config: data.config ?? {} } });
  }

  async update(id: string, data: any) {
    return prisma.constraint.update({ where: { id }, data });
  }

  async remove(id: string) {
    await prisma.constraint.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}

export const constraintsService = new ConstraintsService();
