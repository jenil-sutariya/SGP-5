import { Router } from 'express';
import { z } from 'zod';
import { RoleName } from '@prisma/client';
import prisma from '../../database/prisma';
import { TimetableService } from './timetable.service';
import { TimetableAccess, timetableManagers } from './timetable.access';
import { resourceTimetableService } from './resource-timetable.service';
import { ConflictService } from './conflict.service';
import { withScheduleWrite } from '../scheduler/scheduler.bookings';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { timetableSchema, timetableEntrySchema, paginationSchema } from '../../validators/common';
import { resolveInstituteScope } from '../../utils/instituteScope';

const router = Router();
router.use(authenticate);
router.use(
  asyncHandler(async (req: AuthRequest, res, next) => {
    res.locals.timetableAccess = await TimetableAccess.forUser(req.user);
    res.locals.timetableService = new TimetableService(prisma, res.locals.timetableAccess);
    next();
  })
);
const access = (res: { locals: Record<string, any> }): TimetableAccess =>
  res.locals.timetableAccess;
const service = (res: { locals: Record<string, any> }): TimetableService =>
  res.locals.timetableService;
const manage = authorize(...timetableManagers);

router.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthRequest, res) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await service(res).list({ ...req.query, instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);
router.post(
  '/',
  manage,
  validate(timetableSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const scope = await access(res).generationScope(req.body);
    return ApiResponse.created(
      res,
      await service(res).create({
        ...req.body,
        instituteId: scope.instituteId,
        departmentId: scope.departmentId,
        createdById: req.user!.id,
      })
    );
  })
);
router.get(
  '/views/resource/:kind/:resourceId',
  manage,
  validate(z.object({ kind: z.enum(['room', 'lab']), resourceId: z.string().min(1) }), 'params'),
  validate(
    z.object({
      semesterId: z.string().min(1).optional(),
      week: z.union([z.string().date(), z.literal('auto')]).optional(),
    }),
    'query'
  ),
  asyncHandler(async (req: AuthRequest, res) => {
    await access(res).assertResource(
      req.params.kind as 'room' | 'lab',
      String(req.params.resourceId)
    );
    return ApiResponse.success(
      res,
      await resourceTimetableService.get(
        req.params.kind as 'room' | 'lab',
        String(req.params.resourceId),
        req.user,
        req.query.semesterId as string,
        req.query.week as string | undefined
      )
    );
  })
);
for (const kind of ['faculty', 'section', 'room', 'department'] as const) {
  router.get(
    '/views/' + kind + '/:resourceId',
    asyncHandler(async (req, res) => {
      return ApiResponse.success(
        res,
        await service(res).view(kind, String(req.params.resourceId), req.query.semesterId as string)
      );
    })
  );
}
router.get(
  '/:id',
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).getById(String(req.params.id)))
  )
);
router.patch(
  '/:id',
  manage,
  validate(
    z
      .object({
        name: z.string().min(1).optional(),
        status: z.enum(['DRAFT', 'GENERATED', 'ARCHIVED']).optional(),
      })
      .strict()
  ),
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).update(String(req.params.id), req.body), 'Updated')
  )
);
router.post(
  '/:id/publish',
  manage,
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).publish(String(req.params.id)), 'Published')
  )
);
router.post(
  '/:id/unpublish',
  manage,
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).unpublish(String(req.params.id)), 'Unpublished')
  )
);
router.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).remove(String(req.params.id)))
  )
);
router.get(
  '/:id/entries',
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).getEntries(String(req.params.id)))
  )
);
router.post(
  '/:id/entries',
  manage,
  validate(timetableEntrySchema),
  asyncHandler(async (req, res) =>
    ApiResponse.created(res, await service(res).addEntry(String(req.params.id), req.body))
  )
);
router.patch(
  '/entries/:entryId',
  manage,
  validate(
    z
      .object({
        dayId: z.string().min(1).optional(),
        timeSlotId: z.string().min(1).optional(),
        roomId: z.string().nullable().optional(),
        laboratoryId: z.string().nullable().optional(),
        facultyId: z.string().min(1).optional(),
        isLocked: z.boolean().optional(),
        notes: z.string().optional(),
      })
      .strict()
  ),
  asyncHandler(async (req, res) =>
    ApiResponse.success(
      res,
      await service(res).updateEntry(String(req.params.entryId), req.body),
      'Entry updated'
    )
  )
);
router.delete(
  '/entries/:entryId',
  manage,
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await service(res).deleteEntry(String(req.params.entryId)))
  )
);
router.get(
  '/:id/conflicts',
  manage,
  asyncHandler(async (req, res) => {
    await access(res).assertTimetable(String(req.params.id), true);
    return ApiResponse.success(
      res,
      await prisma.timetableConflict.findMany({
        where: { timetableId: String(req.params.id) },
        orderBy: { createdAt: 'desc' },
      })
    );
  })
);
router.post(
  '/:id/detect-conflicts',
  manage,
  asyncHandler(async (req, res) => {
    const result = await withScheduleWrite(async (db) => {
      await access(res).assertTimetable(String(req.params.id), true, db);
      return new ConflictService(db).detectAndPersist(String(req.params.id));
    }, access(res).user.instituteId ?? undefined);
    return ApiResponse.success(res, result);
  })
);
router.get(
  '/:id/export/excel',
  asyncHandler(async (req, res) => {
    const buffer = await service(res).exportExcel(String(req.params.id));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=timetable.xlsx');
    return res.send(buffer);
  })
);
router.get(
  '/:id/export/pdf',
  asyncHandler(async (req, res) => {
    const buffer = await service(res).exportPdf(String(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=timetable.pdf');
    return res.send(buffer);
  })
);

const sessionChange = z
  .object({
    dayId: z.string().min(1).optional(),
    startTimeSlotId: z.string().min(1).optional(),
    facultyId: z.string().min(1).optional(),
    roomId: z.string().min(1).nullable().optional(),
    laboratoryId: z.string().min(1).nullable().optional(),
    isLocked: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();
router.get(
  '/:id/occurrences',
  validate(z.object({ week: z.string().date().optional() }), 'query'),
  asyncHandler(async (req, res) =>
    ApiResponse.success(
      res,
      await service(res).occurrences(String(req.params.id), req.query.week as string | undefined)
    )
  )
);
router.post(
  '/:id/sessions',
  manage,
  validate(
    sessionChange
      .omit({ isLocked: true })
      .extend({
        courseOfferingId: z.string().min(1),
        facultyId: z.string().min(1),
        sectionId: z.string().min(1),
        practicalBatchId: z.string().nullable().optional(),
        dayId: z.string().min(1),
        startTimeSlotId: z.string().min(1),
      })
  ),
  asyncHandler(async (req, res) =>
    ApiResponse.created(res, await service(res).createSession(String(req.params.id), req.body))
  )
);
router.patch(
  '/:id/sessions/:sessionId',
  manage,
  validate(sessionChange),
  asyncHandler(async (req, res) =>
    ApiResponse.success(
      res,
      await service(res).updateSession(
        String(req.params.id),
        String(req.params.sessionId),
        req.body
      )
    )
  )
);
router.delete(
  '/:id/sessions/:sessionId',
  manage,
  asyncHandler(async (req, res) =>
    ApiResponse.success(
      res,
      await service(res).deleteSession(String(req.params.id), String(req.params.sessionId))
    )
  )
);

export default router;
