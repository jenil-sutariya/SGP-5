import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleName } from '@prisma/client';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError';
import prisma from '../database/prisma';

export interface JwtPayload {
  userId: string;
  email: string;
  role: RoleName;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: RoleName;
    departmentId?: string | null;
    instituteId?: string | null;
  };
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true, institute: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      departmentId: user.departmentId,
      instituteId: user.instituteId,
    };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}

export function authorize(...roles: RoleName[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (roles.length && !roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires one of roles: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}

export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  authenticate(req, _res, next);
}
