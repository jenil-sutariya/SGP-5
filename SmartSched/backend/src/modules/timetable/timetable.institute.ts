import { Prisma } from '@prisma/client';
import prisma from '../../database/prisma';
import { venueSatisfies } from '../scheduler/venue.rules';
import { ValidationError } from '../../utils/AppError';

type EntryScope = {
  timetableId: string;
  courseOfferingId: string;
  facultyId: string;
  sectionId?: string | null;
  practicalBatchId?: string | null;
  roomId?: string | null;
  laboratoryId?: string | null;
  dayId: string;
  timeSlotId: string;
};

// Validate references together: a valid foreign key alone does not ensure institute ownership.
export async function validateEntryInstitute(
  entry: EntryScope,
  db: Prisma.TransactionClient = prisma
) {
  const sectionInclude = { department: true, batch: true } as const;
  const [timetable, offering, section, faculty, room, lab, batch, day, slot] = await Promise.all([
    db.timetable.findUnique({ where: { id: entry.timetableId }, include: { department: true } }),
    db.courseOffering.findUnique({
      where: { id: entry.courseOfferingId },
      include: {
        course: { include: { department: true } },
        subject: { include: { department: true, requirements: true } },
        section: { include: sectionInclude },
      },
    }),
    entry.sectionId
      ? db.section.findUnique({ where: { id: entry.sectionId }, include: sectionInclude })
      : null,
    db.faculty.findUnique({ where: { id: entry.facultyId }, include: { department: true } }),
    entry.roomId
      ? db.room.findUnique({
          where: { id: entry.roomId },
          include: { building: true, department: true },
        })
      : null,
    entry.laboratoryId
      ? db.laboratory.findUnique({
          where: { id: entry.laboratoryId },
          include: { building: true, department: true },
        })
      : null,
    entry.practicalBatchId
      ? db.practicalBatch.findUnique({ where: { id: entry.practicalBatchId } })
      : null,
    db.day.findUnique({ where: { id: entry.dayId } }),
    db.timeSlot.findUnique({ where: { id: entry.timeSlotId } }),
  ]);
  if (
    !timetable ||
    !offering ||
    !faculty ||
    !day ||
    !slot ||
    (entry.sectionId && !section) ||
    (entry.roomId && !room) ||
    (entry.laboratoryId && !lab) ||
    (entry.practicalBatchId && !batch)
  ) {
    throw new ValidationError('A timetable reference was not found');
  }
  if (offering.semesterId !== timetable.semesterId)
    throw new ValidationError('Course offering must belong to the timetable semester');
  if (
    !offering.isActive ||
    !faculty.isActive ||
    (room && !room.isActive) ||
    (lab && !lab.isActive)
  ) {
    throw new ValidationError('Timetable resources must be active');
  }
  const owner = section || offering.section;
  const instituteId = owner?.department.instituteId || offering.course.department.instituteId;
  const assertOwner = (actual: string | null | undefined, label: string) => {
    if (!actual || actual !== instituteId) {
      throw new ValidationError(
        `${label} must belong to the same institute as the timetable batch`
      );
    }
  };
  assertOwner(offering.course.department.instituteId, 'Course');
  assertOwner(offering.subject.department.instituteId, 'Subject');
  assertOwner(faculty.department.instituteId, 'Faculty');
  if (timetable.instituteId) assertOwner(timetable.instituteId, 'Timetable');
  const venue = room || lab;
  if (
    venue &&
    !venueSatisfies(
      venue,
      batch?.capacity ?? owner?.capacity ?? offering.maxStudents,
      offering.subject.requirements
    )
  )
    throw new ValidationError(
      'The selected venue does not meet subject capacity, equipment or room-type requirements'
    );
  const storedInstitute = (timetable.metadata as { instituteId?: string } | null)?.instituteId;
  if (storedInstitute) assertOwner(storedInstitute, 'Timetable');
  if (timetable.department) assertOwner(timetable.department.instituteId, 'Timetable');
  if (owner?.batch) assertOwner(owner.batch.instituteId, 'Student batch');
  if (offering.sectionId && entry.sectionId !== offering.sectionId) {
    throw new ValidationError('Section must match the course offering');
  }
  if (batch && batch.sectionId !== entry.sectionId) {
    throw new ValidationError('Practical batch must belong to the selected section');
  }
  if (room) {
    assertOwner(room.building.instituteId, 'Classroom building');
    if (room.department) assertOwner(room.department.instituteId, 'Classroom department');
  }
  if (lab) {
    assertOwner(lab.building.instituteId, 'Laboratory building');
    assertOwner(lab.department.instituteId, 'Laboratory department');
  }
  // Unowned days and periods are shared calendar definitions, not physical assets.
  if (day.instituteId) assertOwner(day.instituteId, 'Day');
  if (slot.instituteId) assertOwner(slot.instituteId, 'Time slot');
}
