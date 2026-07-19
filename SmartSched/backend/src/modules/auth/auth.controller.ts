import { Response } from 'express';
import { authService } from './auth.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthRequest } from '../../middlewares/auth';

export class AuthController {
  register = asyncHandler(async (req, res: Response) => {
    const result = await authService.register(req.body);
    return ApiResponse.created(res, result, 'Registration successful');
  });

  login = asyncHandler(async (req, res: Response) => {
    const result = await authService.login(req.body, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    });
    return ApiResponse.success(res, result, 'Login successful');
  });

  refresh = asyncHandler(async (req, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    return ApiResponse.success(res, result, 'Token refreshed');
  });

  logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await authService.logout(req.body.refreshToken, req.user?.id);
    return ApiResponse.success(res, result, 'Logout successful');
  });

  forgotPassword = asyncHandler(async (req, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    return ApiResponse.success(res, result);
  });

  resetPassword = asyncHandler(async (req, res: Response) => {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    return ApiResponse.success(res, result);
  });

  changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    return ApiResponse.success(res, result);
  });

  me = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.me(req.user!.id);
    return ApiResponse.success(res, user);
  });
}

export const authController = new AuthController();
