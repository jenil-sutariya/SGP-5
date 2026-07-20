import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { roomService } from './rooms.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { roomSchema, paginationSchema } from '../../validators/common';
import { resolveInstituteScope, assertInstituteAccess } from '../../utils/instituteScope';
import prisma from '../../database/prisma';

const managers = [RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD] as const;

export const roomRouter = Router();
roomRouter.use(authenticate);

// Meta endpoints (before /:id to avoid conflicts)
roomRouter.get(
  '/meta/types',
  asyncHandler(async (_req, res) => ApiResponse.success(res, await roomService.listTypes()))
);

roomRouter.get(
  '/meta/buildings',
  asyncHandler(async (req: AuthRequest, res) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(res, await roomService.listBuildings(instituteId));
  })
);

roomRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await roomService.list({ ...(req.query as any), instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

roomRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await roomService.getById(String(req.params.id));
    if (room.building) assertInstituteAccess(req.user, room.building.instituteId);
    return ApiResponse.success(res, room);
  })
);

roomRouter.post(
  '/',
  authorize(...managers),
  validate(roomSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.body.buildingId) {
      const bldg = await prisma.building.findUnique({ where: { id: req.body.buildingId } });
      if (bldg) assertInstituteAccess(req.user, bldg.instituteId);
    }
    if (req.body.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      if (dept) assertInstituteAccess(req.user, dept.instituteId);
    }
    return ApiResponse.created(res, await roomService.create(req.body));
  })
);

roomRouter.patch(
  '/:id',
  authorize(...managers),
  validate(roomSchema.partial()),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await roomService.getById(String(req.params.id));
    if (room.building) assertInstituteAccess(req.user, room.building.instituteId);
    return ApiResponse.success(res, await roomService.update(String(req.params.id), req.body), 'Updated');
  })
);

roomRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await roomService.getById(String(req.params.id));
    if (room.building) assertInstituteAccess(req.user, room.building.instituteId);
    return ApiResponse.success(res, await roomService.remove(String(req.params.id)));
  })
);
