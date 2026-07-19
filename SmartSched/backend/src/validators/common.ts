import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).passthrough();

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const departmentSchema = z.object({
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  instituteId: z.string().min(1),
  buildingId: z.string().optional().nullable(),
  headId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const facultySchema = z.object({
  employeeId: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  designation: z.string().min(1),
  specialization: z.string().optional(),
  maxHoursPerWeek: z.number().int().min(1).max(40).optional(),
  maxHoursPerDay: z.number().int().min(1).max(10).optional(),
  joiningDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const studentSchema = z.object({
  enrollmentNo: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  programId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  batchYear: z.number().int(),
  currentSemester: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const subjectSchema = z.object({
  code: z.string().min(2).transform((v) => v.toUpperCase()),
  name: z.string().min(2),
  description: z.string().optional(),
  credits: z.number().int().min(0).optional(),
  weeklyHours: z.number().int().min(1).max(10).optional(),
  type: z.enum(['THEORY', 'LAB', 'PRACTICAL', 'TUTORIAL', 'PROJECT']).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  departmentId: z.string().min(1),
  requiresLab: z.boolean().optional(),
  labHours: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const courseSchema = z.object({
  code: z.string().min(2).transform((v) => v.toUpperCase()),
  name: z.string().min(2),
  description: z.string().optional(),
  departmentId: z.string().min(1),
  programId: z.string().optional().nullable(),
  semesterNo: z.number().int().min(1),
  totalCredits: z.number().int().min(0).optional(),
  subjectIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const roomSchema = z.object({
  code: z.string().min(2).transform((v) => v.toUpperCase()),
  name: z.string().min(2),
  buildingId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  roomTypeId: z.string().min(1),
  floor: z.number().int().optional(),
  capacity: z.number().int().min(1),
  hasProjector: z.boolean().optional(),
  hasAC: z.boolean().optional(),
  hasWhiteboard: z.boolean().optional(),
  equipment: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const labSchema = z.object({
  code: z.string().min(2).transform((v) => v.toUpperCase()),
  name: z.string().min(2),
  buildingId: z.string().min(1),
  departmentId: z.string().min(1),
  floor: z.number().int().optional(),
  capacity: z.number().int().min(1),
  equipment: z.string().optional(),
  labType: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const sectionSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).transform((v) => v.toUpperCase()),
  departmentId: z.string().min(1),
  programId: z.string().min(1),
  semesterId: z.string().min(1),
  capacity: z.number().int().min(1).optional(),
  year: z.number().int(),
  isActive: z.boolean().optional(),
});

export const semesterSchema = z.object({
  name: z.string().min(1),
  number: z.number().int().min(1).max(12),
  academicYearId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const academicYearSchema = z.object({
  name: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const availabilitySchema = z.object({
  slots: z.array(
    z.object({
      dayId: z.string(),
      timeSlotId: z.string(),
      isAvailable: z.boolean(),
    })
  ),
});

export const preferenceSchema = z.object({
  dayId: z.string().optional().nullable(),
  timeSlotId: z.string().optional().nullable(),
  preferenceType: z.enum(['PREFERRED', 'AVOID', 'UNAVAILABLE']),
  weight: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const leaveSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export const constraintSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['HARD', 'SOFT']),
  category: z.string().min(1),
  description: z.string().optional(),
  weight: z.number().int().min(0).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const timetableSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
});

export const timetableEntrySchema = z.object({
  courseOfferingId: z.string().min(1),
  facultyId: z.string().min(1),
  roomId: z.string().optional().nullable(),
  laboratoryId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  dayId: z.string().min(1),
  timeSlotId: z.string().min(1),
  isLab: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  notes: z.string().optional(),
});

export const generateTimetableSchema = z.object({
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  name: z.string().optional(),
  useGenetic: z.boolean().optional(),
});
