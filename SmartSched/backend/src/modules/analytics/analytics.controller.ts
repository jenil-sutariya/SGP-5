import { Response } from 'express';
import { analyticsService } from './analytics.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthRequest } from '../../middlewares/auth';
import { resolveInstituteScope } from '../../utils/instituteScope';

export const analyticsController = {
  dashboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(res, await analyticsService.getDashboard(instituteId));
  }),
  roomUtilization: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(res, await analyticsService.getRoomUtilization(instituteId));
  }),
  facultyWorkload: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(res, await analyticsService.getFacultyWorkload(instituteId));
  }),
  timetableStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(res, await analyticsService.getTimetableStatus(instituteId));
  }),
};
