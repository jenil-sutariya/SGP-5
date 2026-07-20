import prisma from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../utils/AppError';
import { getPagination, buildSearchFilter, PaginationQuery } from '../../utils/pagination';

export class RoomService {
  async list(query: PaginationQuery & { departmentId?: string; buildingId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.buildingId   ? { buildingId: query.buildingId }     : {}),
      ...(query.instituteId  ? { building: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { building: true, roomType: true, department: true },
      }),
      prisma.room.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const room = await prisma.room.findUnique({
      where: { id },
      include: { building: true, roomType: true, department: true },
    });
    if (!room) throw new NotFoundError('Room');
    return room;
  }

  async create(data: Parameters<typeof prisma.room.create>[0]['data']) {
    if (await prisma.room.findUnique({ where: { code: data.code as string } })) {
      throw new ConflictError('Room code already exists');
    }
    return prisma.room.create({ data, include: { building: true, roomType: true } });
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    return prisma.room.update({ where: { id }, data, include: { building: true, roomType: true } });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.room.delete({ where: { id } });
    return { message: 'Room deleted' };
  }

  async listTypes() {
    return prisma.roomType.findMany({ orderBy: { name: 'asc' } });
  }

  async listBuildings(instituteId?: string) {
    return prisma.building.findMany({
      where: {
        isActive: true,
        ...(instituteId ? { OR: [{ instituteId }, { instituteId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
      include: { institute: { select: { id: true, code: true, name: true } } },
    });
  }
}

export const roomService = new RoomService();
