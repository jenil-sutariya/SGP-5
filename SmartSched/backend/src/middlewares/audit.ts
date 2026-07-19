import { Request, Response, NextFunction } from 'express';
import prisma from '../database/prisma';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export function auditLog(action: string, entity: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      if (res.statusCode < 400 && req.user) {
        const entityId =
          (req.params.id as string) ||
          (typeof body === 'object' && body && 'data' in body
            ? (body as { data?: { id?: string } }).data?.id
            : undefined);

        prisma.auditLog
          .create({
            data: {
              userId: req.user.id,
              action,
              entity,
              entityId,
              newValues: req.method !== 'GET' ? (req.body as object) : undefined,
              ipAddress: req.ip,
              userAgent: req.get('user-agent') ?? undefined,
            },
          })
          .catch((err) => logger.warn('Audit log failed', { err }));
      }
      return originalJson(body);
    };

    next();
  };
}
