import { RoleName, PreferenceType, LeaveStatus } from '@prisma/client';
import prisma from '../../database/prisma';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/AppError';
import { getPagination, buildSearchFilter } from '../../utils/pagination';
import { hashPassword } from '../../utils/auth';
import { PaginationQuery } from '../../utils/pagination';

export class DepartmentService {
  async list(query: PaginationQuery & { instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.instituteId ? { instituteId: query.instituteId } : {}),
      ...buildSearchFilter(search, ['name', 'code']),
    };
    const [data, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          building: true,
          institute: true,
          _count: { select: { faculty: true, students: true, courses: true } },
        },
      }),
      prisma.department.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        building: true,
        institute: true,
        programs: true,
        faculty: { include: { user: true } },
        batches: true,
      },
    });
    if (!dept) throw new NotFoundError('Department');
    return dept;
  }

  async create(data: {
    code: string;
    name: string;
    description?: string;
    instituteId: string;
    buildingId?: string | null;
    headId?: string | null;
  }) {
    const existing = await prisma.department.findUnique({
      where: { instituteId_code: { instituteId: data.instituteId, code: data.code } },
    });
    if (existing) throw new ConflictError('Department code already exists in this institute');
    return prisma.department.create({ data, include: { institute: true } });
  }

  async update(id: string, data: Partial<{ code: string; name: string; description: string; buildingId: string | null; headId: string | null; isActive: boolean }>) {
    await this.getById(id);
    return prisma.department.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.department.delete({ where: { id } });
    return { message: 'Department deleted' };
  }
}

export class FacultyService {
  async list(query: PaginationQuery & { departmentId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.instituteId ? { department: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['employeeId', 'designation', 'specialization']),
    };
    const [data, total] = await Promise.all([
      prisma.faculty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
          department: true,
        },
      }),
      prisma.faculty.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const faculty = await prisma.faculty.findUnique({
      where: { id },
      include: {
        user: true,
        department: true,
        availability: { include: { day: true, timeSlot: true } },
        preferences: true,
        leaves: true,
      },
    });
    if (!faculty) throw new NotFoundError('Faculty');
    return faculty;
  }

  async create(input: {
    employeeId: string;
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    departmentId: string;
    designation: string;
    specialization?: string;
    maxHoursPerWeek?: number;
    maxHoursPerDay?: number;
    joiningDate?: Date;
  }) {
    const existing = await prisma.faculty.findUnique({ where: { employeeId: input.employeeId } });
    if (existing) throw new ConflictError('Employee ID already exists');
    const emailExists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (emailExists) throw new ConflictError('Email already registered');

    const role = await prisma.role.findUnique({ where: { name: RoleName.FACULTY } });
    if (!role) throw new ValidationError('Faculty role not seeded');

    if (input.email && !input.email.toLowerCase().endsWith('@charusat.edu.in') && !input.email.toLowerCase().endsWith('@charusat.ac.in')) {
      throw new ValidationError('Professor email must be a CHARUSAT address (@charusat.edu.in)');
    }
    const passwordHash = await hashPassword(input.password ?? 'Faculty@123');

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          roleId: role.id,
          departmentId: input.departmentId,
          settings: { create: {} },
        },
      });
      return tx.faculty.create({
        data: {
          employeeId: input.employeeId,
          userId: user.id,
          departmentId: input.departmentId,
          designation: input.designation,
          specialization: input.specialization,
          maxHoursPerWeek: input.maxHoursPerWeek ?? 16,
          maxHoursPerDay: input.maxHoursPerDay ?? 4,
          joiningDate: input.joiningDate,
        },
        include: { user: true, department: true },
      });
    });
  }

  async update(id: string, data: Partial<{ designation: string; specialization: string; maxHoursPerWeek: number; maxHoursPerDay: number; isActive: boolean; departmentId: string }>) {
    await this.getById(id);
    return prisma.faculty.update({
      where: { id },
      data,
      include: { user: true, department: true },
    });
  }

  async remove(id: string) {
    const faculty = await this.getById(id);
    await prisma.user.delete({ where: { id: faculty.userId } });
    return { message: 'Faculty deleted' };
  }

  async getAssignments(facultyId: string) {
    await this.getById(facultyId);
    return prisma.courseAssignment.findMany({
      where: { facultyId },
      include: {
        courseOffering: {
          include: {
            course: true,
            subject: true,
            semester: true,
            section: true,
          },
        },
      },
    });
  }

  async updateAssignments(facultyId: string, courseOfferingIds: string[]) {
    const faculty = await this.getById(facultyId);
    const facultyDeptId = faculty.departmentId;

    // Filter to only course offerings whose subject/course belongs to the faculty's department
    if (courseOfferingIds.length > 0) {
      const offerings = await prisma.courseOffering.findMany({
        where: { id: { in: courseOfferingIds } },
        include: { subject: true, course: true },
      });

      const invalid = offerings.filter((o) => {
        const offeringDeptId = o.subject?.departmentId ?? o.course?.departmentId;
        return offeringDeptId !== facultyDeptId;
      });

      if (invalid.length > 0) {
        const names = invalid.map((o) => o.subject?.name ?? o.id).join(', ');
        throw new ValidationError(
          `Faculty can only be assigned to subjects within their own department. Invalid subjects: ${names}`
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      // Delete all existing assignments
      await tx.courseAssignment.deleteMany({
        where: { facultyId },
      });

      // Insert new assignments (all validated to be in faculty's dept)
      if (courseOfferingIds.length > 0) {
        await tx.courseAssignment.createMany({
          data: courseOfferingIds.map((offeringId) => ({
            facultyId,
            courseOfferingId: offeringId,
            isPrimary: true,
          })),
        });
      }

      // Return current assignments
      return tx.courseAssignment.findMany({
        where: { facultyId },
        include: {
          courseOffering: {
            include: {
              course: true,
              subject: true,
              semester: true,
              section: true,
            },
          },
        },
      });
    });
  }

  async setAvailability(facultyId: string, slots: { dayId: string; timeSlotId: string; isAvailable: boolean }[]) {
    await this.getById(facultyId);
    await prisma.$transaction([
      prisma.facultyAvailability.deleteMany({ where: { facultyId } }),
      prisma.facultyAvailability.createMany({
        data: slots.map((s) => ({ ...s, facultyId })),
      }),
    ]);
    return prisma.facultyAvailability.findMany({
      where: { facultyId },
      include: { day: true, timeSlot: true },
    });
  }

  async getAvailability(facultyId: string) {
    await this.getById(facultyId);
    return prisma.facultyAvailability.findMany({
      where: { facultyId },
      include: { day: true, timeSlot: true },
    });
  }

  async addPreference(facultyId: string, data: { dayId?: string | null; timeSlotId?: string | null; preferenceType: PreferenceType; weight?: number; notes?: string }) {
    await this.getById(facultyId);
    return prisma.facultyPreference.create({
      data: { facultyId, ...data },
    });
  }

  async getPreferences(facultyId: string) {
    return prisma.facultyPreference.findMany({ where: { facultyId }, include: { day: true, timeSlot: true } });
  }

  async addLeave(facultyId: string, data: { startDate: Date; endDate: Date; reason?: string }) {
    await this.getById(facultyId);
    if (data.endDate < data.startDate) throw new ValidationError('End date must be after start date');
    return prisma.facultyLeave.create({ data: { facultyId, ...data } });
  }

  async updateLeaveStatus(leaveId: string, status: LeaveStatus) {
    const leave = await prisma.facultyLeave.findUnique({ where: { id: leaveId } });
    if (!leave) throw new NotFoundError('Leave');
    return prisma.facultyLeave.update({ where: { id: leaveId }, data: { status } });
  }

  async getLeaves(facultyId: string) {
    return prisma.facultyLeave.findMany({ where: { facultyId }, orderBy: { startDate: 'desc' } });
  }
}

export class StudentService {
  async list(query: PaginationQuery & { departmentId?: string; sectionId?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder, search } = getPagination(query);
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.instituteId ? { department: { instituteId: query.instituteId } } : {}),
      ...buildSearchFilter(search, ['enrollmentNo']),
    };
    const [data, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
          department: true,
          section: true,
        },
      }),
      prisma.student.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true, department: true, section: true },
    });
    if (!student) throw new NotFoundError('Student');
    return student;
  }

  async create(input: {
    enrollmentNo: string;
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    departmentId: string;
    programId?: string | null;
    sectionId?: string | null;
    batchYear: number;
    currentSemester?: number;
  }) {
    const existing = await prisma.student.findUnique({ where: { enrollmentNo: input.enrollmentNo } });
    if (existing) throw new ConflictError('Enrollment number already exists');
    const emailExists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (emailExists) throw new ConflictError('Email already registered');

    const role = await prisma.role.findUnique({ where: { name: RoleName.STUDENT } });
    if (!role) throw new ValidationError('Student role not seeded');
    if (!input.email.toLowerCase().endsWith('@charusat.edu.in') && !input.email.toLowerCase().endsWith('@charusat.ac.in')) {
      throw new ValidationError('Student email must be a CHARUSAT address (@charusat.edu.in)');
    }
    const passwordHash = await hashPassword(input.password ?? 'Student@123');

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          roleId: role.id,
          departmentId: input.departmentId,
          settings: { create: {} },
        },
      });
      return tx.student.create({
        data: {
          enrollmentNo: input.enrollmentNo,
          user: { connect: { id: user.id } },
          department: { connect: { id: input.departmentId } },
          ...(input.sectionId ? { section: { connect: { id: input.sectionId } } } : {}),
          batchYear: input.batchYear,
          currentSemester: input.currentSemester ?? 1,
        },
        include: { user: true, department: true, section: true },
      });
    });
  }

  async update(id: string, data: Partial<{ sectionId: string | null; currentSemester: number; isActive: boolean }>) {
    await this.getById(id);
    const { sectionId, ...rest } = data;
    return prisma.student.update({
      where: { id },
      data: {
        ...rest,
        ...(sectionId !== undefined
          ? sectionId
            ? { section: { connect: { id: sectionId } } }
            : { section: { disconnect: true } }
          : {}),
      },
      include: { user: true, department: true, section: true },
    });
  }

  async remove(id: string) {
    const student = await this.getById(id);
    await prisma.user.delete({ where: { id: student.userId } });
    return { message: 'Student deleted' };
  }
}

export const departmentService = new DepartmentService();
export const facultyService = new FacultyService();
export const studentService = new StudentService();
