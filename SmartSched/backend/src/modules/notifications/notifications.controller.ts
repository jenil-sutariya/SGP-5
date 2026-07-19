import { Response } from 'express';
import { notificationsService } from './notifications.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthRequest } from '../../middlewares/auth';

export const notificationsController = {
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await notificationsService.list(req.user!.id, req.query);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  }),
  markRead: asyncHandler(async (req: AuthRequest, res: Response) =>
    ApiResponse.success(res, await notificationsService.markRead(String(req.params.id), req.user!.id))
  ),
  markAllRead: asyncHandler(async (req: AuthRequest, res: Response) =>
    ApiResponse.success(res, await notificationsService.markAllRead(req.user!.id))
  ),
};
