import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import assert from 'node:assert/strict';

// Explicit isolated database only; never run this fixture against the application database.
const url = new URL(process.env.DATABASE_URL!);
url.pathname = '/smartsched_hardening_test';
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const fixture = 'hardening-test';
let checks = 0;
const rollback = new Error('test rollback');
async function trial(
  name: string,
  action: (tx: Prisma.TransactionClient) => Promise<unknown>,
  error?: RegExp
) {
  try {
    await db.$transaction(
      async (tx) => {
        await action(tx);
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
        if (error) throw new Error('Expected rejection: ' + name);
        throw rollback;
      },
      { timeout: 30000 }
    );
  } catch (caught) {
    if (error) assert.match(String(caught), error, name);
    else assert.equal(caught, rollback, name);
  }
  console.log('PASS ' + name);
  checks++;
}

async function main() {
  if (!(await db.institute.findUnique({ where: { id: fixture } })))
    await db.$transaction(
      async (tx) => {
        await tx.institute.create({ data: { id: fixture, code: fixture, name: fixture } });
        await tx.institute.create({ data: { id: 'foreign', code: 'foreign', name: 'foreign' } });
        await tx.department.create({
          data: { id: fixture, code: fixture, name: fixture, instituteId: fixture },
        });
        await tx.program.create({
          data: { id: fixture, code: fixture, name: fixture, degree: 'BE', departmentId: fixture },
        });
        await tx.role.create({ data: { id: fixture, name: 'FACULTY' } });
        for (const id of ['f1', 'f2']) {
          await tx.user.create({
            data: {
              id,
              email: id + '@test.invalid',
              passwordHash: 'not-a-password',
              firstName: id,
              lastName: 'Test',
              roleId: fixture,
              instituteId: fixture,
            },
          });
          await tx.faculty.create({
            data: {
              id,
              userId: id,
              departmentId: fixture,
              employeeId: id,
              designation: 'Teacher',
              maxHoursPerWeek: 40,
              maxHoursPerDay: 8,
            },
          });
        }
        await tx.academicYear.create({
          data: {
            id: fixture,
            name: fixture,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
          },
        });
        await tx.semester.create({
          data: {
            id: fixture,
            name: fixture,
            number: 1,
            academicYearId: fixture,
            startDate: new Date('2026-10-12'),
            endDate: new Date('2026-10-25'),
          },
        });
        await tx.building.create({
          data: { id: fixture, code: fixture, name: fixture, instituteId: fixture },
        });
        await tx.roomType.create({ data: { id: 'class-type', name: 'CLASSROOM' } });
        await tx.roomType.create({ data: { id: 'lab-type', name: 'COMPUTER_LAB' } });
        for (const id of ['r1', 'r2'])
          await tx.room.create({
            data: {
              id,
              code: id,
              name: id,
              buildingId: fixture,
              roomTypeId: 'class-type',
              capacity: 60,
              equipment: 'Projector, Computers',
            },
          });
        await tx.laboratory.create({
          data: {
            id: 'lab',
            code: 'lab',
            name: 'lab',
            departmentId: fixture,
            buildingId: fixture,
            roomTypeId: 'lab-type',
            capacity: 30,
            equipment: 'Computers',
          },
        });
        await tx.day.create({ data: { id: 'mon', name: 'MONDAY', shortName: 'Mon', order: 1 } });
        await tx.day.create({ data: { id: 'tue', name: 'TUESDAY', shortName: 'Tue', order: 2 } });
        for (let i = 0; i < 4; i++)
          await tx.timeSlot.create({
            data: {
              id: 'p' + i,
              name: 'Period ' + i,
              startTime: String(9 + i).padStart(2, '0') + ':00',
              endTime: String(10 + i).padStart(2, '0') + ':00',
              order: i + 1,
            },
          });
        for (const id of ['sec1', 'sec2'])
          await tx.section.create({
            data: {
              id,
              code: id,
              name: id,
              departmentId: fixture,
              programId: fixture,
              semesterId: fixture,
              year: 1,
              capacity: 30,
            },
          });
        for (const id of ['b1', 'b2'])
          await tx.practicalBatch.create({
            data: { id, code: id, name: id, sectionId: 'sec1', capacity: 15 },
          });
        await tx.course.create({
          data: { id: fixture, code: fixture, name: fixture, departmentId: fixture, semesterNo: 1 },
        });
        for (const id of ['theory', 'practical']) {
          await tx.subject.create({
            data: {
              id,
              code: id,
              name: id,
              departmentId: fixture,
              type: id === 'practical' ? 'LAB' : 'THEORY',
              weeklyHours: id === 'practical' ? 2 : 1,
              labHours: id === 'practical' ? 2 : 0,
            },
          });
          await tx.courseOffering.create({
            data: {
              id,
              courseId: fixture,
              subjectId: id,
              sectionId: 'sec1',
              semesterId: fixture,
              assignments: { create: [{ facultyId: 'f1' }, { facultyId: 'f2' }] },
            },
          });
        }
        await tx.subjectRequirement.create({
          data: {
            subjectId: 'theory',
            requirement: 'Projection',
            equipment: 'projector',
            roomTypeId: 'class-type',
            minCapacity: 30,
          },
        });
        for (const id of ['tt1', 'tt2'])
          await tx.timetable.create({
            data: {
              id,
              name: id,
              academicYearId: fixture,
              semesterId: fixture,
              instituteId: fixture,
              departmentId: fixture,
              status: 'GENERATED',
            },
          });
        await tx.timetableEntry.create({
          data: {
            id: 'lecture',
            timetableId: 'tt1',
            courseOfferingId: 'theory',
            facultyId: 'f1',
            sectionId: 'sec1',
            roomId: 'r1',
            dayId: 'mon',
            timeSlotId: 'p0',
            sessionId: 'lecture',
          },
        });
        for (let i = 0; i < 2; i++)
          await tx.timetableEntry.create({
            data: {
              id: 'lab' + i,
              timetableId: 'tt1',
              courseOfferingId: 'practical',
              facultyId: 'f1',
              sectionId: 'sec1',
              practicalBatchId: 'b1',
              laboratoryId: 'lab',
              isLab: true,
              dayId: 'tue',
              timeSlotId: 'p' + i,
              sessionId: 'lab-session',
            },
          });
      },
      { timeout: 30000 }
    );
  const reservationCount = Number(
    (await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM timetable_reservations`)[0].count
  );
  assert.equal(reservationCount, 18);
  console.log('PASS dated reservation backfill');
  checks++;
  await trial('safe room increase', (tx) =>
    tx.room.update({ where: { id: 'r1' }, data: { capacity: 80 } })
  );
  await trial(
    'capacity reduction rolls back',
    (tx) => tx.$executeRaw`UPDATE rooms SET capacity=5 WHERE id='r1'`,
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'equipment removal rolls back',
    (tx) => tx.room.update({ where: { id: 'r1' }, data: { equipment: null } }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'wrong room type rolls back',
    (tx) => tx.room.update({ where: { id: 'r1' }, data: { roomTypeId: 'lab-type' } }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'foreign institute venue rejected',
    (tx) => tx.building.update({ where: { id: fixture }, data: { instituteId: 'foreign' } }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'faculty unavailability rolls back',
    (tx) =>
      tx.facultyAvailability.create({
        data: { facultyId: 'f1', dayId: 'mon', timeSlotId: 'p0', isAvailable: false },
      }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'removing faculty assignment rolls back',
    (tx) => tx.courseAssignment.deleteMany({ where: { facultyId: 'f1' } }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'single period deletion rejected',
    (tx) => tx.timetableEntry.delete({ where: { id: 'lab0' } }),
    /SCHEDULE_CONFLICT/
  );
  await trial('atomic whole lab move succeeds', async (tx) => {
    await tx.timetableEntry.update({ where: { id: 'lab0' }, data: { timeSlotId: 'p1' } });
    await tx.timetableEntry.update({ where: { id: 'lab1' }, data: { timeSlotId: 'p2' } });
  });
  await trial(
    'raw reservation deletion blocked',
    (tx) => tx.$executeRaw`DELETE FROM timetable_reservations`,
    /maintained by timetable triggers/
  );
  await trial(
    'validation queue bypass blocked',
    (tx) => tx.$executeRaw`DELETE FROM scheduling_validation_queue`,
    /maintained by timetable triggers/
  );
  await trial(
    'truncate bypass blocked',
    (tx) => tx.$executeRaw`TRUNCATE timetable_entries CASCADE`,
    /SCHEDULE_CONFLICT/
  );
  const newBatch = (
    tx: Prisma.TransactionClient,
    dayId: string,
    facultyId: string,
    labId: string | null,
    roomId: string | null = null
  ) =>
    tx.timetableEntry.createMany({
      data: [0, 1].map((i) => ({
        id: 'parallel' + i,
        sessionId: 'parallel',
        timetableId: 'tt2',
        courseOfferingId: 'practical',
        facultyId,
        sectionId: 'sec1',
        practicalBatchId: 'b2',
        laboratoryId: labId,
        roomId,
        isLab: true,
        dayId,
        timeSlotId: 'p' + i,
      })),
    });
  await trial(
    'same lab collision rejected',
    (tx) => newBatch(tx, 'tue', 'f2', 'lab'),
    /no_resource_overlap/
  );
  await trial(
    'same faculty collision rejected',
    async (tx) => {
      await tx.laboratory.create({
        data: {
          id: 'lab2',
          code: 'lab2',
          name: 'lab2',
          departmentId: fixture,
          buildingId: fixture,
          capacity: 30,
        },
      });
      await newBatch(tx, 'tue', 'f1', 'lab2');
    },
    /no_resource_overlap/
  );
  await trial('different batches in separate labs permitted', async (tx) => {
    await tx.laboratory.create({
      data: {
        id: 'lab2',
        code: 'lab2',
        name: 'lab2',
        departmentId: fixture,
        buildingId: fixture,
        capacity: 30,
      },
    });
    await newBatch(tx, 'tue', 'f2', 'lab2');
  });
  await trial(
    'whole division conflicts with any practical batch',
    async (tx) => {
      await tx.laboratory.create({
        data: {
          id: 'lab2',
          code: 'lab2',
          name: 'lab2',
          departmentId: fixture,
          buildingId: fixture,
          capacity: 30,
        },
      });
      await newBatch(tx, 'mon', 'f2', 'lab2');
    },
    /no_resource_overlap/
  );
  await trial('archive releases reservations', async (tx) => {
    await tx.timetable.update({ where: { id: 'tt1' }, data: { status: 'ARCHIVED' } });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal(
      (await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM timetable_reservations`)[0]
        .count,
      0n
    );
  });
  await trial('approved leave cancels only dated occurrence', async (tx) => {
    await tx.facultyLeave.create({
      data: {
        facultyId: 'f1',
        startDate: new Date('2026-10-12'),
        endDate: new Date('2026-10-12'),
        status: 'APPROVED',
      },
    });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal(
      (await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM timetable_reservations`)[0]
        .count,
      15n
    );
  });
  await trial('pending leave retains reservations', async (tx) => {
    await tx.facultyLeave.create({
      data: {
        facultyId: 'f1',
        startDate: new Date('2026-10-12'),
        endDate: new Date('2026-10-12'),
        status: 'PENDING',
      },
    });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal(
      (await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM timetable_reservations`)[0]
        .count,
      18n
    );
  });
  await trial('holiday cancels only institute date', async (tx) => {
    await tx.holiday.create({
      data: {
        name: 'Test holiday',
        academicYearId: fixture,
        instituteId: fixture,
        date: new Date('2026-10-12'),
      },
    });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal(
      (await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM timetable_reservations`)[0]
        .count,
      15n
    );
  });

  await trial(
    'faculty workload reductions roll back',
    (tx) => tx.faculty.update({ where: { id: 'f1' }, data: { maxHoursPerWeek: 1 } }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'inactive subject rejected',
    (tx) => tx.subject.update({ where: { id: 'theory' }, data: { isActive: false } }),
    /SCHEDULE_CONFLICT/
  );
  await trial(
    'new lab duration cannot split saved teaching',
    (tx) => tx.subject.update({ where: { id: 'practical' }, data: { labHours: 3 } }),
    /SCHEDULE_CONFLICT/
  );
  await trial('semester change refreshes dated reservations', async (tx) => {
    await tx.semester.update({ where: { id: fixture }, data: { endDate: new Date('2026-10-18') } });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal(
      (
        await tx.$queryRawUnsafe<{ count: bigint }[]>('SELECT count(*) FROM timetable_reservations')
      )[0].count,
      9n
    );
  });
  await trial('foreign holiday does not cancel local bookings', async (tx) => {
    await tx.holiday.create({
      data: {
        name: 'Foreign holiday',
        academicYearId: fixture,
        instituteId: 'foreign',
        date: new Date('2026-10-12'),
      },
    });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal(
      (
        await tx.$queryRawUnsafe<{ count: bigint }[]>('SELECT count(*) FROM timetable_reservations')
      )[0].count,
      18n
    );
  });
  await trial('login timestamp update does not rebuild reservations', async (tx) => {
    await tx.user.update({ where: { id: 'f1' }, data: { lastLoginAt: new Date() } });
    assert.equal(
      (
        await tx.$queryRawUnsafe<{ count: bigint }[]>(
          'SELECT count(*) FROM scheduling_validation_queue'
        )
      )[0].count,
      0n
    );
  });
  await trial(
    'raw SQL rejects overlaps across different slot IDs',
    async (tx) => {
      await tx.courseOffering.create({
        data: {
          id: 'other-offering',
          courseId: fixture,
          subjectId: 'theory',
          sectionId: 'sec2',
          semesterId: fixture,
          assignments: { create: { facultyId: 'f2' } },
        },
      });
      await tx.timeSlot.create({
        data: {
          id: 'overlap-slot',
          name: 'Overlap',
          startTime: '09:30',
          endTime: '10:30',
          order: 9,
        },
      });
      await tx.$executeRawUnsafe(
        `INSERT INTO timetable_entries (id,"timetableId","courseOfferingId","facultyId","sectionId","roomId","dayId","timeSlotId","sessionId","updatedAt") VALUES ('raw-overlap','tt2','other-offering','f2','sec2','r1','mon','overlap-slot','raw-session',now())`
      );
    },
    /no_resource_overlap/
  );
  await trial('adjacent teaching is allowed in the same room', async (tx) => {
    await tx.courseOffering.create({
      data: {
        id: 'other-offering',
        courseId: fixture,
        subjectId: 'theory',
        sectionId: 'sec2',
        semesterId: fixture,
        assignments: { create: { facultyId: 'f2' } },
      },
    });
    await tx.timetableEntry.create({
      data: {
        id: 'adjacent',
        timetableId: 'tt2',
        courseOfferingId: 'other-offering',
        facultyId: 'f2',
        sectionId: 'sec2',
        roomId: 'r1',
        dayId: 'mon',
        timeSlotId: 'p1',
        sessionId: 'adjacent',
      },
    });
  });
  let unlock!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const writer = db
    .$transaction(
      async (tx) => {
        await tx.room.update({ where: { id: 'r1' }, data: { capacity: 61 } });
        started();
        await hold;
        throw rollback;
      },
      { timeout: 30000 }
    )
    .catch((error) => {
      assert.equal(error, rollback);
    });
  await ready;
  try {
    await assert.rejects(
      db.room.update({ where: { id: 'r2' }, data: { capacity: 61 } }),
      /Another scheduling or academic change/
    );
    checks++;
    console.log('PASS concurrent raw writes serialize at the database');
  } finally {
    unlock();
    await writer;
  }

  console.log(checks + ' database checks passed');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
