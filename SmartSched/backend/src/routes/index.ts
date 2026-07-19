import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import { departmentRouter, facultyRouter, studentRouter } from '../modules/departments/department.routes';
import { courseRouter, academicYearRouter, semesterRouter, metaRouter } from '../modules/courses/academic.routes';
import { subjectRouter } from '../modules/subjects/subjects.routes';
import { roomRouter } from '../modules/rooms/rooms.routes';
import { labRouter } from '../modules/labs/labs.routes';
import { sectionRouter } from '../modules/sections/sections.routes';
import timetableRoutes from '../modules/timetable/timetable.routes';
import schedulerRoutes from '../modules/scheduler/scheduler.routes';
import {
  analyticsRouter,
  notificationRouter,
  constraintRouter,
  userRouter,
  logsRouter,
  settingsRouter,
} from '../modules/analytics/misc.routes';
import { instituteRouter, batchRouter } from '../modules/institutes/institute.routes';

const router = Router();

// Auth
router.use('/auth',           authRoutes);

// Users & Roles
router.use('/users',          userRouter);

// Organisation
router.use('/institutes',     instituteRouter);
router.use('/batches',        batchRouter);
router.use('/departments',    departmentRouter);

// People
router.use('/faculty',        facultyRouter);
router.use('/students',       studentRouter);

// Academic Resources
router.use('/subjects',       subjectRouter);
router.use('/courses',        courseRouter);
router.use('/rooms',          roomRouter);
router.use('/labs',           labRouter);
router.use('/sections',       sectionRouter);

// Academic Calendar
router.use('/academic-years', academicYearRouter);
router.use('/semesters',      semesterRouter);
router.use('/meta',           metaRouter);

// Scheduling
router.use('/timetables',     timetableRoutes);
router.use('/scheduler',      schedulerRoutes);

// System
router.use('/analytics',      analyticsRouter);
router.use('/notifications',  notificationRouter);
router.use('/constraints',    constraintRouter);
router.use('/logs',           logsRouter);
router.use('/settings',       settingsRouter);

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'CHARUSAT SmartSched API is healthy',
    university: 'CHARUSAT',
    timestamp: new Date().toISOString(),
  });
});

export default router;
