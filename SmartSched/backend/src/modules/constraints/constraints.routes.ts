import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/errorHandler';
import { constraintSchema } from '../../validators/common';
import { constraintsController } from './constraints.controller';

const router = Router();
router.use(authenticate);

router.get('/',      constraintsController.list);
router.post('/',     authorize(RoleName.ADMIN, RoleName.SCHEDULER), validate(constraintSchema), constraintsController.create);
router.patch('/:id', authorize(RoleName.ADMIN, RoleName.SCHEDULER), validate(constraintSchema.partial()), constraintsController.update);
router.delete('/:id', authorize(RoleName.ADMIN), constraintsController.remove);

export default router;
