import { Router, Response } from 'express';
import { RoleName } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../database/prisma';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/AppError';
import { getPagination, buildSearchFilter } from '../../utils/pagination';
import { resolveInstituteScope, assertInstituteAccess, isSuperAdmin } from '../../utils/instituteScope';

const instituteSchema = z.object({
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(2),
  fullName: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const batchSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).transform((v) => v.toUpperCase()),
  instituteId: z.string().min(1),
  departmentId: z.string().min(1),
  programId: z.string().optional().nullable(),
  batchYear: z.number().int(),
  semesterNo: z.number().int().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
});

export const instituteRouter = Router();
instituteRouter.use(authenticate);

instituteRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const scope = resolveInstituteScope(req.user, req.query.instituteId as string);
    const where = scope ? { id: scope } : {};
    const data = await prisma.institute.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { departments: true, users: true, batches: true } },
        adminUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return ApiResponse.success(res, data);
  })
);

instituteRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const institute = await prisma.institute.findUnique({
      where: { id: String(req.params.id) },
      include: {
        departments: { orderBy: { code: 'asc' } },
        buildings: true,
        batches: {
          include: {
            department: true,
            _count: { select: { students: true, sections: true } },
          },
        },
        adminUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!institute) throw new NotFoundError('Institute');
    assertInstituteAccess(req.user, institute.id);
    return ApiResponse.success(res, institute);
  })
);

instituteRouter.post(
  '/',
  authorize(RoleName.ADMIN),
  validate(instituteSchema),
  asyncHandler(async (req, res: Response) => {
    if (await prisma.institute.findUnique({ where: { code: req.body.code } })) {
      throw new ConflictError('Institute code already exists');
    }
    return ApiResponse.created(res, await prisma.institute.create({ data: req.body }));
  })
);

instituteRouter.patch(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  validate(instituteSchema.partial()),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    assertInstituteAccess(req.user, id);
    if (!isSuperAdmin(req.user?.role) && (req.body.code || req.body.isActive === false)) {
      throw new ForbiddenError('Only university admin can change institute code/status');
    }
    return ApiResponse.success(
      res,
      await prisma.institute.update({ where: { id }, data: req.body }),
      'Updated'
    );
  })
);

export const batchRouter = Router();
batchRouter.use(authenticate);

batchRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit, skip, search, sortBy, sortOrder } = getPagination(req.query);
    const scope = resolveInstituteScope(req.user, req.query.instituteId as string);
    const where = {
      ...(scope ? { instituteId: scope } : {}),
      ...(req.query.departmentId ? { departmentId: String(req.query.departmentId) } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.studentBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          institute: true,
          department: true,
          program: true,
          _count: { select: { students: true, sections: true } },
        },
      }),
      prisma.studentBatch.count({ where }),
    ]);
    return ApiResponse.paginated(res, data, page, limit, total);
  })
);

batchRouter.post(
  '/',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD),
  validate(batchSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId =
      req.user?.role === RoleName.INSTITUTE_ADMIN ? req.user.instituteId! : req.body.instituteId;
    assertInstituteAccess(req.user, instituteId);
    const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
    if (!dept || dept.instituteId !== instituteId) {
      throw new ConflictError('Department does not belong to this institute');
    }
    const batch = await prisma.studentBatch.create({
      data: { ...req.body, instituteId },
      include: { department: true, institute: true },
    });
    return ApiResponse.created(res, batch);
  })
);

batchRouter.patch(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD),
  validate(batchSchema.partial()),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.studentBatch.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) throw new NotFoundError('Student batch');
    assertInstituteAccess(req.user, existing.instituteId);
    return ApiResponse.success(
      res,
      await prisma.studentBatch.update({
        where: { id: existing.id },
        data: req.body,
        include: { department: true, institute: true },
      }),
      'Updated'
    );
  })
);

batchRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.studentBatch.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) throw new NotFoundError('Student batch');
    assertInstituteAccess(req.user, existing.instituteId);
    await prisma.studentBatch.delete({ where: { id: existing.id } });
    return ApiResponse.success(res, { message: 'Batch deleted' });
  })
);
