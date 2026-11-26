import { Prisma, RoleName } from '@prisma/client';
import prisma from '../../database/prisma';
import { AuthRequest } from '../../middlewares/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/AppError';
import { assertInstituteAccess, resolveInstituteScope } from '../../utils/instituteScope';

export const timetableManagers = [
  RoleName.ADMIN,
  RoleName.INSTITUTE_ADMIN,
  RoleName.SCHEDULER,
  RoleName.DEPARTMENT_HEAD,
] as const;
export const facultyNameSelect = { id: true, firstName: true, lastName: true } as const;

export class TimetableAccess {
  private constructor(
    readonly user: NonNullable<AuthRequest['user']>,
    readonly entryWhere: Prisma.TimetableEntryWhereInput,
    readonly timetableWhere: Prisma.TimetableWhereInput,
    readonly restricted: boolean
  ) {}

  static async forUser(user: AuthRequest['user'], db: Prisma.TransactionClient = prisma) {
    if (!user) throw new ForbiddenError();
    const instituteId = resolveInstituteScope(user);
    let entryWhere: Prisma.TimetableEntryWhereInput = {};
    let restricted = false;
    if (user.role === RoleName.STUDENT) {
      const student = await db.student.findUnique({
        where: { userId: user.id },
        include: { department: true, section: true, practicalBatch: true },
      });
      if (
        !student?.isActive ||
        !student.sectionId ||
        student.department.instituteId !== instituteId ||
        student.section?.departmentId !== student.departmentId ||
        (student.practicalBatch && student.practicalBatch.sectionId !== student.sectionId)
      ) {
        throw new ForbiddenError(
          'Your student account needs a valid institute, division and batch assignment'
        );
      }
      entryWhere = {
        sectionId: student.sectionId,
        OR: [
          { practicalBatchId: null },
          ...(student.practicalBatchId ? [{ practicalBatchId: student.practicalBatchId }] : []),
        ],
      };
      restricted = true;
    } else if (user.role === RoleName.FACULTY) {
      const faculty = await db.faculty.findUnique({
        where: { userId: user.id },
        include: { department: true },
      });
      if (!faculty?.isActive || faculty.department.instituteId !== instituteId)
        throw new ForbiddenError('Your faculty account needs a valid institute assignment');
      entryWhere = { facultyId: faculty.id };
      restricted = true;
    } else if (user.role === RoleName.DEPARTMENT_HEAD) {
      if (!user.departmentId) throw new ForbiddenError('Your account has no department assigned');
      const department = await db.department.findUnique({ where: { id: user.departmentId } });
      assertInstituteAccess(user, department?.instituteId);
      entryWhere = { section: { departmentId: user.departmentId } };
      restricted = true;
    } else if (!timetableManagers.includes(user.role as (typeof timetableManagers)[number])) {
      throw new ForbiddenError();
    }
    const timetableWhere: Prisma.TimetableWhereInput = {
      ...(instituteId ? { instituteId } : {}),
      ...(user.role === RoleName.STUDENT ? { status: 'PUBLISHED' } : {}),
      ...(restricted
        ? {
            OR: [
              { entries: { some: entryWhere } },
              ...(user.role === RoleName.DEPARTMENT_HEAD
                ? [{ departmentId: user.departmentId! }]
                : []),
            ],
          }
        : {}),
    };
    return new TimetableAccess(user, entryWhere, timetableWhere, restricted);
  }

  assertManager() {
    if (!timetableManagers.includes(this.user.role as (typeof timetableManagers)[number]))
      throw new ForbiddenError('Only timetable managers can make this change');
  }

  async assertTimetable(id: string, write = false, db: Prisma.TransactionClient = prisma) {
    if (write) this.assertManager();
    const timetable = await db.timetable.findFirst({
      where: { AND: [{ id }, this.timetableWhere] },
    });
    if (!timetable) throw new NotFoundError('Timetable');
    if (
      write &&
      this.user.role === RoleName.DEPARTMENT_HEAD &&
      timetable.departmentId !== this.user.departmentId
    ) {
      throw new ForbiddenError(
        'Only the institute administrator can manage an institute-wide timetable'
      );
    }
    return timetable;
  }

  async assertEntry(id: string, write = false, db: Prisma.TransactionClient = prisma) {
    const entry = await db.timetableEntry.findFirst({
      where: { AND: [{ id, timetable: this.timetableWhere }, this.entryWhere] },
    });
    if (!entry) throw new NotFoundError('Timetable entry');
    await this.assertTimetable(entry.timetableId, write, db);
    return entry;
  }

  async assertResource(
    kind: 'faculty' | 'section' | 'room' | 'lab' | 'department',
    id: string,
    db: Prisma.TransactionClient = prisma
  ) {
    if (kind === 'department') {
      this.assertManager();
      const department = await db.department.findUnique({ where: { id } });
      if (!department) throw new NotFoundError('Department');
      assertInstituteAccess(this.user, department.instituteId);
      if (this.user.role === RoleName.DEPARTMENT_HEAD && id !== this.user.departmentId)
        throw new ForbiddenError('You can only access your department');
      return;
    }
    if (kind === 'room' || kind === 'lab') {
      this.assertManager();
      const resource =
        kind === 'room'
          ? await db.room.findUnique({ where: { id }, include: { building: true } })
          : await db.laboratory.findUnique({ where: { id }, include: { building: true } });
      if (!resource) throw new NotFoundError('Resource');
      assertInstituteAccess(this.user, resource.building.instituteId);
      return;
    }
    const resource =
      kind === 'faculty'
        ? await db.faculty.findUnique({ where: { id }, include: { department: true } })
        : await db.section.findUnique({ where: { id }, include: { department: true } });
    if (!resource) throw new NotFoundError(kind);
    assertInstituteAccess(this.user, resource.department.instituteId);
    if (
      this.user.role === RoleName.DEPARTMENT_HEAD &&
      resource.departmentId !== this.user.departmentId
    )
      throw new ForbiddenError('You can only access your department');
    if (
      this.user.role === RoleName.STUDENT &&
      (kind !== 'section' || id !== this.entryWhere.sectionId)
    )
      throw new ForbiddenError('You can only view your division');
    if (
      this.user.role === RoleName.FACULTY &&
      (kind !== 'faculty' || id !== this.entryWhere.facultyId)
    )
      throw new ForbiddenError('You can only view your own teaching');
  }

  async generationScope(
    input: { instituteId?: string | null; departmentId?: string | null; sectionId?: string | null },
    db: Prisma.TransactionClient = prisma
  ) {
    this.assertManager();
    let instituteId = resolveInstituteScope(this.user, input.instituteId);
    let departmentId = input.departmentId;
    if (input.sectionId) {
      const section = await db.section.findUnique({ where: { id: input.sectionId } });
      if (!section) throw new NotFoundError('Section');
      if (departmentId && departmentId !== section.departmentId)
        throw new ValidationError('Section must belong to the selected department');
      departmentId = section.departmentId;
    }
    if (this.user.role === RoleName.DEPARTMENT_HEAD) {
      if (departmentId && departmentId !== this.user.departmentId)
        throw new ForbiddenError('You can only manage your department');
      departmentId = this.user.departmentId;
    }
    if (departmentId) {
      const department = await db.department.findUnique({ where: { id: departmentId } });
      if (!department) throw new NotFoundError('Department');
      assertInstituteAccess(this.user, department.instituteId);
      if (instituteId && instituteId !== department.instituteId)
        throw new ValidationError('Department must belong to the selected institute');
      instituteId = department.instituteId;
    }
    if (!instituteId) throw new ValidationError('Select an institute');
    return { instituteId, departmentId: departmentId || null, sectionId: input.sectionId || null };
  }
}
