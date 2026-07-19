import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { courseService, academicService } from './academic.services';
import prisma from '../../database/prisma';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import {
  courseSchema,
  semesterSchema,
  academicYearSchema,
  paginationSchema,
} from '../../validators/common';
import { resolveInstituteScope } from '../../utils/instituteScope';

const managers = [RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD] as const;

// ─── Course Router ────────────────────────────────────────────────────────────

export const courseRouter = Router();
courseRouter.use(authenticate);

courseRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await courseService.list({ ...req.query, instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

courseRouter.get(
  '/offerings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    return ApiResponse.success(res, await courseService.listOfferings(instituteId));
  })
);


courseRouter.get(
  '/:id/subjects',
  asyncHandler(async (req, res: Response) => {
    const course = await courseService.getById(String(req.params.id));
    const subjects = await prisma.subject.findMany({
      where: { departmentId: course.departmentId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return ApiResponse.success(res, subjects);
  })
);

courseRouter.get(
  '/:id',
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await courseService.getById(String(req.params.id)))
  )
);

courseRouter.post(
  '/',
  authorize(...managers),
  validate(courseSchema),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.created(res, await courseService.create(req.body))
  )
);

courseRouter.patch(
  '/:id',
  authorize(...managers),
  validate(courseSchema.partial()),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await courseService.update(String(req.params.id), req.body), 'Updated')
  )
);

courseRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN),
  asyncHandler(async (req, res: Response) =>
    ApiResponse.success(res, await courseService.remove(String(req.params.id)))
  )
);

// ─── Academic Year Router ─────────────────────────────────────────────────────

export const academicYearRouter = Router();
academicYearRouter.use(authenticate);

academicYearRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await academicService.listYears(req.query);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

academicYearRouter.post(
  '/',
  authorize(RoleName.ADMIN),
  validate(academicYearSchema),
  asyncHandler(async (req, res) =>
    ApiResponse.created(res, await academicService.createYear(req.body))
  )
);

academicYearRouter.patch(
  '/:id',
  authorize(RoleName.ADMIN),
  validate(academicYearSchema.partial()),
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await academicService.updateYear(String(req.params.id), req.body), 'Updated')
  )
);

academicYearRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN),
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await academicService.deleteYear(String(req.params.id)))
  )
);

// ─── Semester Router ──────────────────────────────────────────────────────────

export const semesterRouter = Router();
semesterRouter.use(authenticate);

semesterRouter.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await academicService.listSemesters(req.query as never);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  })
);

semesterRouter.post(
  '/',
  authorize(RoleName.ADMIN),
  validate(semesterSchema),
  asyncHandler(async (req, res) =>
    ApiResponse.created(res, await academicService.createSemester(req.body))
  )
);

semesterRouter.patch(
  '/:id',
  authorize(RoleName.ADMIN),
  validate(semesterSchema.partial()),
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await academicService.updateSemester(String(req.params.id), req.body), 'Updated')
  )
);

semesterRouter.delete(
  '/:id',
  authorize(RoleName.ADMIN),
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, await academicService.deleteSemester(String(req.params.id)))
  )
);

// ─── Meta Router (days, time-slots) ──────────────────────────────────────────

export const metaRouter = Router();
metaRouter.use(authenticate);
metaRouter.get('/days',       asyncHandler(async (req: AuthRequest, res) => {
  const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
  return ApiResponse.success(res, await academicService.listDays(instituteId));
}));
metaRouter.get('/time-slots', asyncHandler(async (req: AuthRequest, res) => {
  const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
  return ApiResponse.success(res, await academicService.listTimeSlots(instituteId));
}));
metaRouter.get('/programs',   asyncHandler(async (req: AuthRequest, res) => {
  const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
  const result = await prisma.program.findMany({
    where: {
      isActive: true,
      ...(instituteId ? { department: { instituteId } } : {}),
    },
    orderBy: { name: 'asc' },
  });
  return ApiResponse.success(res, result);
}));
