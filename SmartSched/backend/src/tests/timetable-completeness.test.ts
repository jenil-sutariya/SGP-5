import { Prisma } from '@prisma/client';
import { assertTeachingComplete } from '../modules/timetable/timetable.completeness';
const timetable = { id: 'tt', semesterId: 'sem', departmentId: 'it', metadata: null };
function dbWith(
  entries: { courseOfferingId: string; practicalBatchId: string | null }[],
  type = 'THEORY'
) {
  return {
    timetableEntry: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([{ sectionId: 'it-a' }])
        .mockResolvedValueOnce(entries),
    },
    courseOffering: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'offering',
            subject: { code: 'IT101', type, weeklyHours: 2, labHours: 2 },
            section: { practicalBatches: type === 'LAB' ? [{ id: 'b1' }, { id: 'b2' }] : [] },
          },
        ]),
    },
  } as unknown as Prisma.TransactionClient;
}
test('publishing rejects missing theory periods even when metadata says complete', async () => {
  await expect(
    assertTeachingComplete(
      dbWith([{ courseOfferingId: 'offering', practicalBatchId: null }]),
      timetable
    )
  ).rejects.toThrow('found 1');
});
test('publishing accepts complete scheduled teaching', async () => {
  await expect(
    assertTeachingComplete(
      dbWith(Array(2).fill({ courseOfferingId: 'offering', practicalBatchId: null })),
      timetable
    )
  ).resolves.toBeUndefined();
});
test('publishing rejects duplicate surplus teaching', async () => {
  await expect(
    assertTeachingComplete(
      dbWith(Array(3).fill({ courseOfferingId: 'offering', practicalBatchId: null })),
      timetable
    )
  ).rejects.toThrow('found 3');
});
test('every practical batch needs the complete lab block', async () => {
  const entries = Array(2).fill({ courseOfferingId: 'offering', practicalBatchId: 'b1' });
  await expect(assertTeachingComplete(dbWith(entries, 'LAB'), timetable)).rejects.toThrow(
    'found 0'
  );
});
