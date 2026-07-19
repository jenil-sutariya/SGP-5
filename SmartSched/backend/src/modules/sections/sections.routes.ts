import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { sectionService } from './sections.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { sectionSchema, paginationSchema } from '../../validators/common';
import { resolveInstituteScope } from '../../utils/instituteScope';

const managers = [RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD] as const;

export const sectionRouter = Router();
sectionRouter.use(authenticate);

sectionRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await sectionService.list({ ...(req.query as any), instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

sectionRouter.get(
  '/:id',
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await sectionService.getById(String(req.params.id)))
  )
);

sectionRouter.post(
  '/',
  authorize(...managers),
  validate(sectionSchema),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.created(res, await sectionService.create(req.body))
  )
);

sectionRouter.patch(
  '/:id',
  authorize(...managers),
  validate(sectionSchema.partial()),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await sectionService.update(String(req.params.id), req.body), 'Updated')
  )
);

sectionRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req: AuthRequest, res: Response) =>
    ApiResponse.success(res, await sectionService.remove(String(req.params.id)))
  )
);

sectionRouter.post(
  '/:id/auto-create-batches',
  authorize(...managers),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const batchSize = req.body.batchSize ? Number(req.body.batchSize) : 20;
    const result = await sectionService.autoCreateBatches(String(req.params.id), batchSize);
    return ApiResponse.success(res, result, 'Batches auto-created');
  })
);
