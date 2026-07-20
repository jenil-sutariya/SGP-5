import { RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { ForbiddenError } from './AppError';

/** University-wide admin (Super Admin) */
export function isSuperAdmin(role?: RoleName) {
  return role === RoleName.ADMIN;
}

/** Institute admin */
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
 * Super admin (RoleName.ADMIN): optional query instituteId.
 * Non-super-admin with user.instituteId: forced strictly to their user.instituteId.
 */
export function resolveInstituteScope(
  user: AuthRequest['user'],
  queryInstituteId?: string | null
): string | undefined {
  if (!user) throw new ForbiddenError();
  if (isSuperAdmin(user.role)) {
    return queryInstituteId || undefined;
  }
  return user.instituteId || queryInstituteId || undefined;
}

/**
 * Asserts that the authenticated user has access to manage/view a resource
 * belonging to resourceInstituteId.
 */
export function assertInstituteAccess(user: AuthRequest['user'], resourceInstituteId?: string | null) {
  if (!user) throw new ForbiddenError();
  if (isSuperAdmin(user.role)) return; // Super admin has global access

  if (user.instituteId) {
    if (!resourceInstituteId || resourceInstituteId !== user.instituteId) {
      throw new ForbiddenError('You can only manage data for your institute');
    }
  }
}
