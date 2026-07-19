import { RoleName } from '@prisma/client';
import prisma from '../../database/prisma';
import { NotFoundError } from '../../utils/AppError';
import { getPagination, buildSearchFilter } from '../../utils/pagination';
import { hashPassword, sanitizeUser } from '../../utils/auth';

export class UsersService {
  async list(query: Record<string, unknown>) {
    const { page, limit, skip, search, sortBy, sortOrder } = getPagination(query);
    const where = buildSearchFilter(search, ['email', 'firstName', 'lastName']);
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { role: true, department: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { data: data.map(sanitizeUser), total, page, limit };
  }

  async create(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: RoleName;
    departmentId?: string;
  }) {
    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw new NotFoundError('Role');
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roleId: role.id,
        departmentId: input.departmentId,
        settings: { create: {} },
      },
      include: { role: true },
    });
    return sanitizeUser(user);
  }

  async update(id: string, data: { firstName?: string; lastName?: string; phone?: string; isActive?: boolean; departmentId?: string }) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isActive: data.isActive,
        departmentId: data.departmentId,
      },
      include: { role: true },
    });
    return sanitizeUser(user);
  }
}

export const usersService = new UsersService();
