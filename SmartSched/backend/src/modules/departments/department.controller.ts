import { LeaveStatus, RoleName } from '@prisma/client';
import { Response } from 'express';
import { departmentService, facultyService, studentService } from './department.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthRequest } from '../../middlewares/auth';
import { resolveInstituteScope, assertInstituteAccess } from '../../utils/instituteScope';
import prisma from '../../database/prisma';

export const departmentController = {
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await departmentService.list({ ...req.query, instituteId });
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  }),
  get: asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await departmentService.getById(String(req.params.id));
    assertInstituteAccess(req.user, data.instituteId);
    return ApiResponse.success(res, data);
  }),
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user?.role === RoleName.INSTITUTE_ADMIN && req.user.instituteId) {
      req.body.instituteId = req.user.instituteId;
    }
    assertInstituteAccess(req.user, req.body.instituteId);
    const data = await departmentService.create(req.body);
    return ApiResponse.created(res, data);
  }),
  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const dept = await departmentService.getById(String(req.params.id));
    assertInstituteAccess(req.user, dept.instituteId);
    const data = await departmentService.update(String(req.params.id), req.body);
    return ApiResponse.success(res, data, 'Updated');
  }),
  remove: asyncHandler(async (req: AuthRequest, res: Response) => {
    const dept = await departmentService.getById(String(req.params.id));
    assertInstituteAccess(req.user, dept.instituteId);
    const data = await departmentService.remove(String(req.params.id));
    return ApiResponse.success(res, data);
  }),
};

export const facultyController = {
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await facultyService.list({ ...req.query, instituteId } as never);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  }),
  get: asyncHandler(async (req: AuthRequest, res: Response) => {
    const fac = await facultyService.getById(String(req.params.id));
    if (fac?.department) assertInstituteAccess(req.user, fac.department.instituteId);
    return ApiResponse.success(res, fac);
  }),
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.body.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      if (dept) assertInstituteAccess(req.user, dept.instituteId);
    }
    return ApiResponse.created(res, await facultyService.create(req.body));
  }),
  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const fac = await facultyService.getById(String(req.params.id));
    if (fac?.department) assertInstituteAccess(req.user, fac.department.instituteId);
    return ApiResponse.success(res, await facultyService.update(String(req.params.id), req.body), 'Updated');
  }),
  remove: asyncHandler(async (req: AuthRequest, res: Response) => {
    const fac = await facultyService.getById(String(req.params.id));
    if (fac?.department) assertInstituteAccess(req.user, fac.department.instituteId);
    return ApiResponse.success(res, await facultyService.remove(String(req.params.id)));
  }),
  getAvailability: asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await facultyService.getAvailability(String(req.params.id)));
  }),
  setAvailability: asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(
      res,
      await facultyService.setAvailability(String(req.params.id), req.body.slots),
      'Availability updated'
    );
  }),
  getPreferences: asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await facultyService.getPreferences(String(req.params.id)));
  }),
  addPreference: asyncHandler(async (req, res: Response) => {
    return ApiResponse.created(res, await facultyService.addPreference(String(req.params.id), req.body));
  }),
  getLeaves: asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await facultyService.getLeaves(String(req.params.id)));
  }),
  addLeave: asyncHandler(async (req, res: Response) => {
    return ApiResponse.created(res, await facultyService.addLeave(String(req.params.id), req.body));
  }),
  updateLeaveStatus: asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(
      res,
      await facultyService.updateLeaveStatus(String(req.params.leaveId), req.body.status as LeaveStatus)
    );
  }),
  getAssignments: asyncHandler(async (req, res: Response) => {
    return ApiResponse.success(res, await facultyService.getAssignments(String(req.params.id)));
  }),
  updateAssignments: asyncHandler(async (req, res: Response) => {
    const { courseOfferingIds } = req.body;
    if (!Array.isArray(courseOfferingIds)) {
      return ApiResponse.error(res, 'courseOfferingIds must be an array of strings', 400);
    }
    return ApiResponse.success(
      res,
      await facultyService.updateAssignments(String(req.params.id), courseOfferingIds),
      'Assignments updated'
    );
  }),
};

export const studentController = {
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const instituteId = resolveInstituteScope(req.user, req.query.instituteId as string);
    const result = await studentService.list({ ...req.query, instituteId } as never);
    return ApiResponse.paginated(res, result.data, result.page, result.limit, result.total);
  }),
  get: asyncHandler(async (req: AuthRequest, res: Response) => {
    const stu = await studentService.getById(String(req.params.id));
    if (stu?.department) assertInstituteAccess(req.user, stu.department.instituteId);
    return ApiResponse.success(res, stu);
  }),
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.body.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      if (dept) assertInstituteAccess(req.user, dept.instituteId);
    }
    return ApiResponse.created(res, await studentService.create(req.body));
  }),
  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const stu = await studentService.getById(String(req.params.id));
    if (stu?.department) assertInstituteAccess(req.user, stu.department.instituteId);
    return ApiResponse.success(res, await studentService.update(String(req.params.id), req.body), 'Updated');
  }),
  remove: asyncHandler(async (req: AuthRequest, res: Response) => {
    const stu = await studentService.getById(String(req.params.id));
    if (stu?.department) assertInstituteAccess(req.user, stu.department.instituteId);
    return ApiResponse.success(res, await studentService.remove(String(req.params.id)));
  }),
};

export { RoleName };
