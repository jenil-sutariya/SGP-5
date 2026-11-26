import { DifficultyLevel, SubjectType } from '@prisma/client';
import prisma from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../utils/AppError';
import { getPagination, buildSearchFilter, PaginationQuery } from '../../utils/pagination';

export class SubjectService {
  async list(query: PaginationQuery & { departmentId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.instituteId ? { department: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { department: true, requirements: true },
      }),
      prisma.subject.count({ where }),
    ]);
    return {
      data: data.map((subject) => {
        const requirement = subject.requirements.find(
          (r) => r.requirement === 'Venue requirements'
        );
        return {
          ...subject,
          requiredEquipment: requirement?.equipment,
          requiredRoomTypeId: requirement?.roomTypeId,
          minRoomCapacity: requirement?.minCapacity,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getById(id: string) {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: { department: true, requirements: { include: { roomType: true } } },
    });
    if (!subject) throw new NotFoundError('Subject');
    return subject;
  }

  async create(data: {
    requiredEquipment?: string | null;
    requiredRoomTypeId?: string | null;
    minRoomCapacity?: number | null;
    code: string;
    name: string;
    description?: string;
    credits?: number;
    weeklyHours?: number;
    type?: SubjectType;
    difficulty?: DifficultyLevel;
    departmentId: string;
    requiresLab?: boolean;
    labHours?: number;
  }) {
    if (await prisma.subject.findUnique({ where: { code: data.code } })) {
      throw new ConflictError('Subject code already exists');
    }
    const { requiredEquipment, requiredRoomTypeId, minRoomCapacity, ...fields } = data;
    return prisma.subject.create({
      data: {
        ...fields,
        ...(requiredEquipment || requiredRoomTypeId || minRoomCapacity
          ? {
              requirements: {
                create: {
                  requirement: 'Venue requirements',
                  equipment: requiredEquipment,
                  roomTypeId: requiredRoomTypeId,
                  minCapacity: minRoomCapacity,
                },
              },
            }
          : {}),
      },
      include: { department: true },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.getById(id);
    const { requiredEquipment, requiredRoomTypeId, minRoomCapacity, ...fields } = data;
    const changing = ['requiredEquipment', 'requiredRoomTypeId', 'minRoomCapacity'].some(
      (key) => key in data
    );
    return prisma.subject.update({
      where: { id },
      data: {
        ...fields,
        ...(changing
          ? {
              requirements: {
                deleteMany: { requirement: 'Venue requirements' },
                ...(requiredEquipment || requiredRoomTypeId || minRoomCapacity
                  ? {
                      create: {
                        requirement: 'Venue requirements',
                        equipment: requiredEquipment as string | null,
                        roomTypeId: requiredRoomTypeId as string | null,
                        minCapacity: minRoomCapacity as number | null,
                      },
                    }
                  : {}),
              },
            }
          : {}),
      },
      include: { department: true },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.subject.delete({ where: { id } });
    return { message: 'Subject deleted' };
  }
}

export const subjectService = new SubjectService();
