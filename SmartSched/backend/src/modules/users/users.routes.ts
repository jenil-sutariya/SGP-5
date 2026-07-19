import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { paginationSchema } from '../../validators/common';
import { usersController } from './users.controller';

const createUserSchema = z.object({
  email:        z.string().email(),
  password:     z.string().min(8),
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  role:         z.nativeEnum(RoleName),
  departmentId: z.string().optional(),
});

const updateUserSchema = z.object({
  firstName:    z.string().min(1).optional(),
  lastName:     z.string().min(1).optional(),
  phone:        z.string().optional(),
  isActive:     z.boolean().optional(),
  departmentId: z.string().optional(),
});

const router = Router();
router.use(authenticate, authorize(RoleName.ADMIN));

router.get('/',      validate(paginationSchema, 'query'), usersController.list);
router.post('/',     validate(createUserSchema),          usersController.create);
router.patch('/:id', validate(updateUserSchema),          usersController.update);

export default router;
