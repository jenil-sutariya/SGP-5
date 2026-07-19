import { Router, Response } from 'express';
import { RoleName } from '@prisma/client';
import { timetableService } from './timetable.service';
import { conflictService } from './conflict.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { timetableSchema, timetableEntrySchema, paginationSchema } from '../../validators/common';
import { resolveInstituteScope, assertInstituteAccess } from '../../utils/instituteScope';
import prisma from '../../database/prisma';

const router = Router();
router.use(authenticate);

router.get('/', validate(paginationSchema, 'query'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
  const result = await timetableService.list({ ...req.query, instituteId } as never);
  return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
}));

router.post('/', authorize(RoleName.ADMIN, RoleName.SCHEDULER, RoleName.DEPARTMENT_HEAD), validate(timetableSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
    if (dept) {
      assertInstituteAccess(req.user, dept.instituteId);
    }
  }
  return ApiResponse.created(res, await timetableService.create({ ...req.body, createdById: req.user?.id }));
}));

router.get('/views/faculty/:facultyId', asyncHandler(async (req, res) => {
  return ApiResponse.success(res, await timetableService.viewByFaculty(String(req.params.facultyId), req.query.semesterId as string));
}));
router.get('/views/section/:sectionId', asyncHandler(async (req, res) => {
  return ApiResponse.success(res, await timetableService.viewBySection(String(req.params.sectionId), req.query.semesterId as string));
}));
router.get('/views/room/:roomId', asyncHandler(async (req, res) => {
  return ApiResponse.success(res, await timetableService.viewByRoom(String(req.params.roomId), req.query.semesterId as string));
}));
router.get('/views/department/:departmentId', asyncHandler(async (req, res) => {
  return ApiResponse.success(res, await timetableService.viewByDepartment(String(req.params.departmentId), req.query.semesterId as string));
}));

router.get('/:id', asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.getById(String(req.params.id)))));
router.patch('/:id', authorize(RoleName.ADMIN, RoleName.SCHEDULER), asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.update(String(req.params.id), req.body), 'Updated')));
router.post('/:id/publish', authorize(RoleName.ADMIN, RoleName.SCHEDULER), asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.publish(String(req.params.id)), 'Published')));
router.delete('/:id', authorize(RoleName.ADMIN), asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.remove(String(req.params.id)))));

router.get('/:id/entries', asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.getEntries(String(req.params.id)))));
router.post('/:id/entries', authorize(RoleName.ADMIN, RoleName.SCHEDULER, RoleName.DEPARTMENT_HEAD), validate(timetableEntrySchema), asyncHandler(async (req, res) => ApiResponse.created(res, await timetableService.addEntry(String(req.params.id), req.body))));
router.patch('/entries/:entryId', authorize(RoleName.ADMIN, RoleName.SCHEDULER, RoleName.DEPARTMENT_HEAD), validate(timetableEntrySchema.partial()), asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.updateEntry(String(req.params.entryId), req.body), 'Entry updated')));
router.delete('/entries/:entryId', authorize(RoleName.ADMIN, RoleName.SCHEDULER), asyncHandler(async (req, res) => ApiResponse.success(res, await timetableService.deleteEntry(String(req.params.entryId)))));

router.get('/:id/conflicts', asyncHandler(async (req, res) => {
  const conflicts = await prismaConflicts(String(req.params.id));
  return ApiResponse.success(res, conflicts);
}));
router.post('/:id/detect-conflicts', authorize(RoleName.ADMIN, RoleName.SCHEDULER), asyncHandler(async (req, res) => {
  return ApiResponse.success(res, await conflictService.detectAndPersist(String(req.params.id)));
}));

router.get('/:id/export/excel', asyncHandler(async (req, res) => {
  const buffer = await timetableService.exportExcel(String(req.params.id));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=timetable-${String(req.params.id)}.xlsx`);
  return res.send(buffer);
}));

router.get('/:id/export/pdf', asyncHandler(async (req, res) => {
  const buffer = await timetableService.exportPdf(String(req.params.id));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=timetable-${String(req.params.id)}.pdf`);
  return res.send(buffer);
}));

async function prismaConflicts(timetableId: string) {
  const { default: prisma } = await import('../../database/prisma');
  return prisma.timetableConflict.findMany({ where: { timetableId }, orderBy: { createdAt: 'desc' } });
}

export default router;
