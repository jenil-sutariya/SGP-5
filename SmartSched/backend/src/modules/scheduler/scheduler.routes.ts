import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { schedulerService } from './scheduler.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { generateTimetableSchema } from '../../validators/common';
import { assertInstituteAccess, resolveInstituteScope } from '../../utils/instituteScope';
import prisma from '../../database/prisma';

const router = Router();
const canSchedule = [RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.SCHEDULER, RoleName.DEPARTMENT_HEAD] as const;

router.use(authenticate);

router.post(
  '/generate',
  authorize(...canSchedule),
  validate(generateTimetableSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.body.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      if (dept) {
        assertInstituteAccess(req.user, dept.instituteId);
      }
    }
    if (req.body.sectionId) {
      const sec = await prisma.section.findUnique({
        where: { id: req.body.sectionId },
        include: { department: true },
      });
      if (sec) {
        assertInstituteAccess(req.user, sec.department.instituteId);
      }
    }
    const instituteId = resolveInstituteScope(req.user, req.body.instituteId as string);
    const data = await schedulerService.generate({ ...req.body, instituteId, createdById: req.user?.id });
    return ApiResponse.created(res, data, 'Timetable generated');
  })
);

router.get(
  '/status/:timetableId',
  asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await schedulerService.getStatus(String(req.params.timetableId)));
  })
);

router.post(
  '/optimize/:timetableId',
  authorize(...canSchedule),
  asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await schedulerService.optimize(String(req.params.timetableId)), 'Optimized');
  })
);

router.post(
  '/resolve-conflicts/:timetableId',
  authorize(...canSchedule),
  asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await schedulerService.resolveConflicts(String(req.params.timetableId)));
  })
);

export default router;
