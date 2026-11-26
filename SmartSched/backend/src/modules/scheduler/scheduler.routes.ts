import { withScheduleWrite } from './scheduler.bookings';
import { ConflictService } from '../timetable/conflict.service';
import { Router } from 'express';
import { schedulerService } from './scheduler.service';
import { TimetableAccess, timetableManagers } from '../timetable/timetable.access';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { generateTimetableSchema } from '../../validators/common';

const router = Router();
router.use(authenticate, authorize(...timetableManagers));
router.post(
  '/generate',
  validate(generateTimetableSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const access = await TimetableAccess.forUser(req.user);
    const scope = await access.generationScope(req.body);
    return ApiResponse.created(
      res,
      await schedulerService.generate({ ...req.body, ...scope, createdById: req.user!.id }),
      'Timetable generated'
    );
  })
);
router.get(
  '/status/:timetableId',
  asyncHandler(async (req: AuthRequest, res) => {
    const access = await TimetableAccess.forUser(req.user);
    await access.assertTimetable(String(req.params.timetableId), true);
    return ApiResponse.success(
      res,
      await schedulerService.getStatus(String(req.params.timetableId))
    );
  })
);
router.post(
  '/optimize/:timetableId',
  asyncHandler(async (req: AuthRequest, res) => {
    const access = await TimetableAccess.forUser(req.user);
    await access.assertTimetable(String(req.params.timetableId), true);
    return ApiResponse.success(
      res,
      await schedulerService.optimize(String(req.params.timetableId)),
      'Missing sessions scheduled'
    );
  })
);
router.post(
  '/resolve-conflicts/:timetableId',
  asyncHandler(async (req: AuthRequest, res) => {
    const access = await TimetableAccess.forUser(req.user);
    await access.assertTimetable(String(req.params.timetableId), true);
    return ApiResponse.success(
      res,
      await withScheduleWrite(async (db) => {
        await access.assertTimetable(String(req.params.timetableId), true, db);
        return {
          resolved: 0,
          remaining: await new ConflictService(db).detectAndPersist(String(req.params.timetableId)),
        };
      }, access.user.instituteId ?? undefined)
    );
  })
);
export default router;
