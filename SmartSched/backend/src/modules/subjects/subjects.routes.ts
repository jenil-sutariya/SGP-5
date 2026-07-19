import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { subjectService } from './subjects.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { subjectSchema, paginationSchema } from '../../validators/common';
import { resolveInstituteScope } from '../../utils/instituteScope';

const managers = [RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD] as const;

export const subjectRouter = Router();
subjectRouter.use(authenticate);

subjectRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await subjectService.list({ ...req.query, instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

subjectRouter.get(
  '/:id',
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await subjectService.getById(String(req.params.id)))
  )
);

subjectRouter.post(
  '/',
  authorize(...managers),
  validate(subjectSchema),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.created(res, await subjectService.create(req.body))
  )
);

subjectRouter.patch(
  '/:id',
  authorize(...managers),
  validate(subjectSchema.partial()),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await subjectService.update(String(req.params.id), req.body), 'Updated')
  )
);

subjectRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await subjectService.remove(String(req.params.id)))
  )
);
