import { Prisma } from '@prisma/client';
import { ConflictError } from '../../utils/AppError';

// Count all active saved periods for the requested teaching scope, including earlier generations.
export async function assertTeachingComplete(
  db: Prisma.TransactionClient,
  timetable: {
    id: string;
    semesterId: string;
    departmentId: string | null;
    metadata: Prisma.JsonValue;
  }
) {
  const metadata = timetable.metadata as { sectionId?: string; instituteId?: string } | null;
  const targetEntries = await db.timetableEntry.findMany({
    where: { timetableId: timetable.id },
    select: { sectionId: true },
  });
  const sectionIds = [
    ...new Set(targetEntries.map((e) => e.sectionId).filter((id): id is string => !!id)),
  ];
  const offerings = await db.courseOffering.findMany({
    where: {
      semesterId: timetable.semesterId,
      isActive: true,
      ...(metadata?.sectionId
        ? { sectionId: metadata.sectionId }
        : timetable.departmentId
          ? { section: { departmentId: timetable.departmentId } }
          : metadata?.instituteId
            ? { section: { department: { instituteId: metadata.instituteId } } }
            : { sectionId: { in: sectionIds } }),
    },
    include: {
      subject: true,
      section: { include: { practicalBatches: { where: { isActive: true } } } },
    },
  });
  if (!offerings.length)
    throw new ConflictError('No teaching requirements were found for this timetable');
  const entries = await db.timetableEntry.findMany({
    where: {
      courseOfferingId: { in: offerings.map((o) => o.id) },
      timetable: { semesterId: timetable.semesterId, status: { in: ['GENERATED', 'PUBLISHED'] } },
    },
  });
  for (const offering of offerings) {
    const subject = offering.subject;
    const expected =
      subject.type === 'LAB'
        ? Math.max(2, subject.labHours || 2)
        : subject.type === 'PRACTICAL'
          ? subject.weeklyHours === 1
            ? 1
            : 2
          : subject.weeklyHours;
    const batchIds: (string | null)[] =
      subject.type === 'LAB' && offering.section?.practicalBatches.length
        ? offering.section.practicalBatches.map((b) => b.id)
        : [null];
    for (const batchId of batchIds) {
      const count = entries.filter(
        (e) => e.courseOfferingId === offering.id && e.practicalBatchId === batchId
      ).length;
      if (count !== expected)
        throw new ConflictError(
          subject.code +
            ' requires ' +
            expected +
            ' periods per week for each group; found ' +
            count +
            '. Complete or repair the timetable before publishing.'
        );
    }
  }
}
