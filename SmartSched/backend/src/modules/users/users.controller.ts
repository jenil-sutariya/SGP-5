import { Response } from 'express';
import { usersService } from './users.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const usersController = {
  list: asyncHandler(async (req, res: Response) => {
    const result = await usersService.list(req.query);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  }),
  create: asyncHandler(async (req, res: Response) =>
    ApiResponse.created(res, await usersService.create(req.body))
  ),
  update: asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await usersService.update(String(req.params.id), req.body), 'Updated')
  ),
};
