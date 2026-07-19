import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { settingsService } from './settings.service';

const router = Router();
router.use(authenticate);

// Global settings
router.get('/',       asyncHandler(async (_req, res) =>
  ApiResponse.success(res, await settingsService.listGlobal())
));
router.put('/:key',   authorize(RoleName.ADMIN), asyncHandler(async (req, res) =>
  ApiResponse.success(res, await settingsService.upsertGlobal(
    String(req.params.key),
    req.body.value,
    req.body.category,
    req.body.label
  ), 'Saved')
));

// Per-user settings
router.get('/me',     asyncHandler(async (req: AuthRequest, res) =>
  ApiResponse.success(res, await settingsService.getUserSettings(req.user!.id))
));
router.patch('/me',   asyncHandler(async (req: AuthRequest, res) =>
  ApiResponse.success(res, await settingsService.updateUserSettings(req.user!.id, req.body), 'Updated')
));

export default router;
