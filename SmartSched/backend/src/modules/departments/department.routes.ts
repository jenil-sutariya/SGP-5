import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { departmentController, facultyController, studentController } from './department.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import {
  departmentSchema,
  facultySchema,
  studentSchema,
  availabilitySchema,
  preferenceSchema,
  leaveSchema,
  paginationSchema,
} from '../../validators/common';
import { z } from 'zod';

export const departmentRouter = Router();
departmentRouter.use(authenticate);
departmentRouter.get('/', validate(paginationSchema, 'query'), departmentController.list);
departmentRouter.get('/:id', departmentController.get);
departmentRouter.post('/', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), validate(departmentSchema), departmentController.create);
departmentRouter.patch('/:id', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), validate(departmentSchema.partial()), departmentController.update);
departmentRouter.delete('/:id', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN), departmentController.remove);

export const facultyRouter = Router();
facultyRouter.use(authenticate);
facultyRouter.get('/', validate(paginationSchema, 'query'), facultyController.list);
facultyRouter.get('/:id', facultyController.get);
facultyRouter.post('/', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), validate(facultySchema), facultyController.create);
facultyRouter.patch('/:id', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), validate(facultySchema.partial()), facultyController.update);
facultyRouter.delete('/:id', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN), facultyController.remove);
facultyRouter.get('/:id/availability', facultyController.getAvailability);
facultyRouter.put('/:id/availability', authorize(RoleName.ADMIN, RoleName.DEPARTMENT_HEAD, RoleName.FACULTY), validate(availabilitySchema), facultyController.setAvailability);
facultyRouter.get('/:id/preferences', facultyController.getPreferences);
facultyRouter.post('/:id/preferences', authorize(RoleName.ADMIN, RoleName.DEPARTMENT_HEAD, RoleName.FACULTY), validate(preferenceSchema), facultyController.addPreference);
facultyRouter.get('/:id/leaves', facultyController.getLeaves);
facultyRouter.post('/:id/leaves', authorize(RoleName.ADMIN, RoleName.DEPARTMENT_HEAD, RoleName.FACULTY), validate(leaveSchema), facultyController.addLeave);
facultyRouter.patch('/leaves/:leaveId/status', authorize(RoleName.ADMIN, RoleName.DEPARTMENT_HEAD), validate(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']) })), facultyController.updateLeaveStatus);
facultyRouter.get('/:id/assignments', facultyController.getAssignments);
facultyRouter.post('/:id/assignments', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), facultyController.updateAssignments);

export const studentRouter = Router();
studentRouter.use(authenticate);
studentRouter.get('/', validate(paginationSchema, 'query'), studentController.list);
studentRouter.get('/:id', studentController.get);
studentRouter.post('/', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), validate(studentSchema), studentController.create);
studentRouter.patch('/:id', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN, RoleName.DEPARTMENT_HEAD), validate(studentSchema.partial()), studentController.update);
studentRouter.delete('/:id', authorize(RoleName.ADMIN, RoleName.INSTITUTE_ADMIN), studentController.remove);
