import { TimetableAccess } from '../timetable/timetable.access';
import { Response } from 'express';
import { analyticsService } from './analytics.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthRequest } from '../../middlewares/auth';
import { ForbiddenError } from '../../utils/AppError';
import { resolveInstituteScope } from '../../utils/instituteScope';

export const analyticsController = {
  dashboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== 'ADMIN' && !req.user?.instituteId) {
      throw new ForbiddenError('Your account needs an institute to view the dashboard');
    }
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(
      res,
      await analyticsService.getDashboard(
        instituteId,
        req.user!.id,
        await TimetableAccess.forUser(req.user)
      )
    );
  }),
  roomUtilization: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    (await TimetableAccess.forUser(req.user)).assertManager();
    return ApiResponse.success(res, await analyticsService.getRoomUtilization(instituteId));
  }),
  facultyWorkload: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    (await TimetableAccess.forUser(req.user)).assertManager();
    return ApiResponse.success(res, await analyticsService.getFacultyWorkload(instituteId));
  }),
  timetableStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(
      res,
      await analyticsService.getTimetableStatus(
        instituteId,
        await TimetableAccess.forUser(req.user)
      )
    );
  }),
};
