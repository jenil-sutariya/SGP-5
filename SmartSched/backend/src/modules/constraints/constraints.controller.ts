import { Response } from 'express';
import { constraintsService } from './constraints.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const constraintsController = {
  list: asyncHandler(async (req, res: Response) => {
    const result = await constraintsService.list(req.query);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  }),
  create: asyncHandler(async (req, res: Response) =>
    ApiResponse.created(res, await constraintsService.create(req.body))
  ),
  update: asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await constraintsService.update(String(req.params.id), req.body), 'Updated')
  ),
  remove: asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await constraintsService.remove(String(req.params.id)))
  ),
};
