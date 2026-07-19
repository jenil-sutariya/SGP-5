import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { labService } from './labs.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { labSchema, paginationSchema } from '../../validators/common';
import { resolveInstituteScope } from '../../utils/instituteScope';

const managers = [RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD] as const;

export const labRouter = Router();
labRouter.use(authenticate);

labRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await labService.list({ ...(req.query as any), instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

labRouter.get(
  '/:id',
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await labService.getById(String(req.params.id)))
  )
);

labRouter.post(
  '/',
  authorize(...managers),
  validate(labSchema),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.created(res, await labService.create(req.body))
  )
);

labRouter.patch(
  '/:id',
  authorize(...managers),
  validate(labSchema.partial()),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await labService.update(String(req.params.id), req.body), 'Updated')
  )
);

labRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await labService.remove(String(req.params.id)))
  )
);
