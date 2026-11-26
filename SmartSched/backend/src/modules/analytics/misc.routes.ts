import { Router, Response } from 'express';
import { RoleName } from '@prisma/client';
import prisma from '../../database/prisma';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { constraintSchema, paginationSchema } from '../../validators/common';
import { NotFoundError } from '../../utils/AppError';
import { getPagination, buildSearchFilter } from '../../utils/pagination';
import { hashPassword, sanitizeUser } from '../../utils/auth';
import { z } from 'zod';
import { analyticsController } from './analytics.controller';

// ---------- Analytics ----------
export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

analyticsRouter.get('/dashboard', analyticsController.dashboard);

analyticsRouter.get('/room-utilization', analyticsController.roomUtilization);
analyticsRouter.get('/faculty-workload', analyticsController.facultyWorkload);
analyticsRouter.get('/timetable-status', analyticsController.timetableStatus);

// ---------- Notifications ----------
export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const where = { userId: req.user!.id };
    const [data, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    return ApiResponse.paginated(res, data, page, limit, total);
  })
);

notificationRouter.patch(
  '/:id/read',
  asyncHandler(async (req: AuthRequest, res) => {
    const n = await prisma.notification.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!n) throw new NotFoundError('Notification');
    return ApiResponse.success(
      res,
      await prisma.notification.update({ where: { id: n.id }, data: { isRead: true } })
    );
  })
);

notificationRouter.post(
  '/read-all',
  asyncHandler(async (req: AuthRequest, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    return ApiResponse.success(res, { message: 'All notifications marked as read' });
  })
);

// ---------- Constraints ----------
export const constraintRouter = Router();
constraintRouter.use(authenticate);

constraintRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip, search } = getPagination(req.query);
    const where = buildSearchFilter(search, ['name', 'category']);
    const [data, total] = await Promise.all([
      prisma.constraint.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.constraint.count({ where }),
    ]);
    return ApiResponse.paginated(res, data, page, limit, total);
  })
);

constraintRouter.post(
  '/',
  authorize(RoleName.ADMIN, RoleName.SCHEDULER),
  validate(constraintSchema),
  asyncHandler(async (req, res) => {
    return ApiResponse.created(res, await prisma.constraint.create({ data: req.body }));
  })
);

constraintRouter.patch(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.SCHEDULER),
  validate(constraintSchema.partial()),
  asyncHandler(async (req, res) => {
    return ApiResponse.success(
      res,
      await prisma.constraint.update({ where: { id: String(req.params.id) }, data: req.body }),
      'Updated'
    );
  })
);

constraintRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.constraint.delete({ where: { id: String(req.params.id) } });
    return ApiResponse.success(res, { message: 'Deleted' });
  })
);

// ---------- Users ----------
export const userRouter = Router();
userRouter.use(authenticate);
userRouter.use(authorize(RoleName.ADMIN));

userRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, search, sortBy, sortOrder } = getPagination(req.query);
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
    return ApiResponse.paginated(res, data.map(sanitizeUser), page, limit, total);
  })
);

userRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
        isActive: req.body.isActive,
        departmentId: req.body.departmentId,
      },
      include: { role: true },
    });
    return ApiResponse.success(res, sanitizeUser(user), 'Updated');
  })
);

userRouter.post(
  '/',
  validate(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string(),
      lastName: z.string(),
      role: z.nativeEnum(RoleName),
      departmentId: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findUnique({ where: { name: req.body.role } });
    if (!role) throw new NotFoundError('Role');
    const passwordHash = await hashPassword(req.body.password);
    const user = await prisma.user.create({
      data: {
        email: req.body.email.toLowerCase(),
        passwordHash,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        roleId: role.id,
        departmentId: req.body.departmentId,
        settings: { create: {} },
      },
      include: { role: true },
    });
    return ApiResponse.created(res, sanitizeUser(user));
  })
);

// ---------- Audit Logs ----------
export const logsRouter = Router();
logsRouter.use(authenticate, authorize(RoleName.ADMIN));

logsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return ApiResponse.paginated(res, data, page, limit, total);
  })
);

// ---------- Settings ----------
export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    return ApiResponse.success(
      res,
      await prisma.setting.findMany({ orderBy: { category: 'asc' } })
    );
  })
);

settingsRouter.put(
  '/:key',
  authorize(RoleName.ADMIN),
  asyncHandler(async (req, res) => {
    const setting = await prisma.setting.upsert({
      where: { key: String(req.params.key) },
      create: {
        key: String(req.params.key),
        value: req.body.value,
        category: req.body.category ?? 'general',
        label: req.body.label,
      },
      update: { value: req.body.value, label: req.body.label },
    });
    return ApiResponse.success(res, setting, 'Saved');
  })
);

settingsRouter.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const settings = await prisma.userSetting.findUnique({ where: { userId: req.user!.id } });
    return ApiResponse.success(res, settings);
  })
);

settingsRouter.patch(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const settings = await prisma.userSetting.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...req.body },
      update: req.body,
    });
    return ApiResponse.success(res, settings, 'Updated');
  })
);
