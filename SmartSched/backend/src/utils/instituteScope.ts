import { RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { ForbiddenError } from './AppError';

/** University-wide admin */
export function isSuperAdmin(role?: RoleName) {
  return role === RoleName.ADMIN;
}

/** CSPIT / DEPSTAR institute admin */
export function isInstituteAdmin(role?: RoleName) {
  return role === RoleName.INSTITUTE_ADMIN;
}

/** Can manage academic data (scoped or global) */
export function canManageInstitute(role?: RoleName) {
  return (
    role === RoleName.ADMIN ||
    role === RoleName.INSTITUTE_ADMIN ||
    role === RoleName.DEPARTMENT_HEAD ||
    role === RoleName.SCHEDULER
  );
}

/**
 * Institute filter for list queries.
 * Super admin: optional query instituteId.
 * Institute admin: forced to their instituteId.
 */
export function resolveInstituteScope(
  user: AuthRequest['user'],
  queryInstituteId?: string | null
): string | undefined {
  if (!user) throw new ForbiddenError();
  if (isInstituteAdmin(user.role)) {
    if (!user.instituteId) throw new ForbiddenError('Institute admin is not linked to an institute');
    return user.instituteId;
  }
  if (isSuperAdmin(user.role) || user.role === RoleName.SCHEDULER) {
    return queryInstituteId || undefined;
  }
  return user.instituteId || undefined;
}

export function assertInstituteAccess(user: AuthRequest['user'], resourceInstituteId?: string | null) {
  if (!user) throw new ForbiddenError();
  if (isSuperAdmin(user.role)) return;
  if (isInstituteAdmin(user.role)) {
    if (!user.instituteId || resourceInstituteId !== user.instituteId) {
      throw new ForbiddenError('You can only manage data for your institute');
    }
  }
}
