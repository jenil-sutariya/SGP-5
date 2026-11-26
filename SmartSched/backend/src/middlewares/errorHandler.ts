import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // PostgreSQL deferred scheduling checks also protect ordinary academic CRUD transactions.
  const databaseMessage = String((err as Error).message || '');
  const scheduleMessage = /SCHEDULE_CONFLICT: ([^\n]+)/.exec(databaseMessage)?.[1];
  if (scheduleMessage || databaseMessage.includes('no_resource_overlap')) {
    return ApiResponse.error(
      res,
      scheduleMessage ||
        'This change would double-book a classroom, lab, faculty member or student group. No changes were saved.',
      409,
      'SCHEDULE_CONFLICT'
    );
  }
  if (err instanceof ZodError) {
    return ApiResponse.error(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    );
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error', { error: err });
    }
    return ApiResponse.error(
      res,
      err.message,
      err.statusCode,
      err.code,
      err.details,
      config.isDev ? err.stack : undefined
    );
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return ApiResponse.error(
    res,
    config.isProd ? 'Internal server error' : err.message,
    500,
    'INTERNAL_ERROR',
    undefined,
    config.isDev ? err.stack : undefined
  );
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND'));
}

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
}
