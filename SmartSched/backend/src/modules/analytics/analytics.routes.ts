import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { analyticsController } from './analytics.controller';

const router = Router();
router.use(authenticate);

router.get('/dashboard',         analyticsController.dashboard);
router.get('/room-utilization',  analyticsController.roomUtilization);
router.get('/faculty-workload',  analyticsController.facultyWorkload);
router.get('/timetable-status',  analyticsController.timetableStatus);

export default router;
