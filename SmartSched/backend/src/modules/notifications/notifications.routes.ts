import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { notificationsController } from './notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/',              notificationsController.list);
router.patch('/:id/read',   notificationsController.markRead);
router.post('/read-all',    notificationsController.markAllRead);

export default router;
