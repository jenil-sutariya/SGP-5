import 'dotenv/config';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/smartsched_hardening_test';
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '1000';
  process.env.LOG_LEVEL = 'error';
  const { createApp } = await import('../src/app');
  const app = createApp();
  const { default: db } = await import('../src/database/prisma');
  const { config } = await import('../src/config');
  let checks = 0;
  const auth = (id: string) =>
    'Bearer ' + jwt.sign({ userId: id }, config.jwt.accessSecret, { expiresIn: '10m' });
  const base = '/api/v1';
  async function call(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    user: string,
    status: number,
    body?: unknown
  ) {
    const response = await request(app)
      [method](base + path)
      .set('Authorization', auth(user))
      .send(body as any);
    assert.equal(
      response.status,
      status,
      method + ' ' + path + ' as ' + user + ': ' + JSON.stringify(response.body)
    );
    checks++;
    return response;
  }
  try {
    for (const [id, role, instituteId, departmentId] of [
      ['admin', 'ADMIN', null, null],
      ['manager', 'INSTITUTE_ADMIN', 'hardening-test', null],
      ['foreign-manager', 'INSTITUTE_ADMIN', 'foreign', null],
      ['unscoped', 'INSTITUTE_ADMIN', null, null],
      ['head', 'DEPARTMENT_HEAD', 'hardening-test', 'hardening-test'],
      ['student', 'STUDENT', 'hardening-test', 'hardening-test'],
    ] as const) {
      const r = await db.role.upsert({ where: { name: role }, create: { name: role }, update: {} });
      await db.user.upsert({
        where: { id },
        create: {
          id,
          email: id + '@test.invalid',
          passwordHash: 'not-a-password',
          firstName: id,
          lastName: 'Test',
          roleId: r.id,
          instituteId,
          departmentId,
        },
        update: { roleId: r.id, instituteId, departmentId },
      });
    }
    await db.student.upsert({
      where: { userId: 'student' },
      create: {
        userId: 'student',
        enrollmentNo: 'test-student',
        departmentId: 'hardening-test',
        sectionId: 'sec1',
        practicalBatchId: 'b1',
        batchYear: 2026,
      },
      update: {},
    });
    await db.timetable.upsert({
      where: { id: 'foreign-tt' },
      create: {
        id: 'foreign-tt',
        name: 'Foreign draft',
        academicYearId: 'hardening-test',
        semesterId: 'hardening-test',
        instituteId: 'foreign',
      },
      update: {},
    });
    await call('get', '/timetables', 'unscoped', 403);
    await call('get', '/timetables?instituteId=foreign', 'manager', 403);
    for (const [method, path] of [
      ['get', '/timetables/foreign-tt'],
      ['patch', '/timetables/foreign-tt'],
      ['delete', '/timetables/foreign-tt'],
      ['get', '/timetables/foreign-tt/entries'],
      ['get', '/timetables/foreign-tt/export/excel'],
      ['get', '/timetables/foreign-tt/export/pdf'],
      ['get', '/timetables/foreign-tt/occurrences'],
      ['get', '/timetables/foreign-tt/conflicts'],
      ['post', '/timetables/foreign-tt/detect-conflicts'],
      ['post', '/timetables/foreign-tt/publish'],
      ['post', '/timetables/foreign-tt/unpublish'],
      ['get', '/scheduler/status/foreign-tt'],
      ['post', '/scheduler/optimize/foreign-tt'],
      ['post', '/scheduler/resolve-conflicts/foreign-tt'],
      ['patch', '/timetables/foreign-tt/sessions/none'],
      ['delete', '/timetables/foreign-tt/sessions/none'],
    ] as const)
      await call(method, path, 'manager', 404, method === 'patch' ? {} : undefined);
    await call('get', '/timetables/foreign-tt', 'admin', 200);
    await call('get', '/timetables/views/resource/room/r1', 'foreign-manager', 403);
    await call('patch', '/timetables/entries/lecture', 'foreign-manager', 404, { dayId: 'mon' });
    await call('post', '/scheduler/generate', 'manager', 403, {
      instituteId: 'foreign',
      academicYearId: 'hardening-test',
      semesterId: 'hardening-test',
    });
    await call('post', '/scheduler/generate', 'student', 403, {});
    assert.equal((await call('get', '/timetables', 'student', 200)).body.data.length, 0);
    await call('get', '/timetables/tt1', 'student', 404);
    await call('get', '/timetables/tt1/export/excel', 'student', 404);
    await call('get', '/timetables/views/faculty/f2', 'f1', 403);
    const own = await call('get', '/timetables/tt1', 'f1', 200);
    assert(own.body.data.entries.every((e: any) => e.facultyId === 'f1'));
    assert(!JSON.stringify(own.body).includes('passwordHash'));
    await call('patch', '/timetables/entries/lab0', 'manager', 409, { timeSlotId: 'p1' });
    await call('patch', '/timetables/tt1/sessions/lab-session', 'manager', 200, {
      startTimeSlotId: 'p1',
    });
    assert.deepEqual(
      (
        await db.timetableEntry.findMany({
          where: { sessionId: 'lab-session' },
          orderBy: { id: 'asc' },
        })
      ).map((e) => e.timeSlotId),
      ['p1', 'p2']
    );
    await call('patch', '/timetables/tt1/sessions/lab-session', 'manager', 200, { isLocked: true });
    await call('patch', '/timetables/tt1/sessions/lab-session', 'manager', 409, {
      startTimeSlotId: 'p0',
    });
    await call('delete', '/timetables/tt1/sessions/lab-session', 'manager', 409);
    await call('patch', '/timetables/tt1/sessions/lab-session', 'manager', 200, {
      isLocked: false,
    });
    await call('patch', '/timetables/tt1/sessions/lab-session', 'manager', 200, {
      startTimeSlotId: 'p0',
    });
    await call('post', '/timetables/tt1/publish', 'manager', 409);
    const created = await call('post', '/timetables/tt2/sessions', 'manager', 201, {
      courseOfferingId: 'practical',
      facultyId: 'f2',
      sectionId: 'sec1',
      practicalBatchId: 'b2',
      laboratoryId: 'lab',
      dayId: 'mon',
      startTimeSlotId: 'p1',
    });
    assert.equal(created.body.data.length, 2);
    await call('post', '/timetables/tt1/publish', 'manager', 200);
    const published = await call('get', '/timetables/tt1', 'student', 200);
    assert.equal(published.body.data.entries.length, 3);
    assert(
      published.body.data.entries.every(
        (e: any) => !e.practicalBatchId || e.practicalBatchId === 'b1'
      )
    );
    assert.equal(published.body.data.metadata, null);
    await call('get', '/timetables/tt1/export/excel', 'student', 200);
    await call('get', '/timetables/tt1/export/pdf', 'student', 200);
    await call('get', '/timetables/views/section/sec2', 'student', 403);
    await call('get', '/timetables/views/resource/lab/lab', 'student', 403);
    const dashboard = await call('get', '/analytics/dashboard', 'student', 200);
    assert(dashboard.body.data.timetableStatus.every((s: any) => s.status === 'PUBLISHED'));
    await call('patch', '/timetables/tt1/sessions/lab-session', 'manager', 409, { dayId: 'mon' });
    await call('patch', '/rooms/r1', 'manager', 409, { capacity: 5 });
    assert.equal((await db.room.findUniqueOrThrow({ where: { id: 'r1' } })).capacity, 60);
    await call('post', '/timetables/tt1/unpublish', 'manager', 200);
    await call('get', '/timetables/tt1', 'student', 404);
    await call('get', '/timetables/tt1/occurrences', 'student', 404);
    await call('get', '/timetables/tt1/export/pdf', 'student', 404);
    await call(
      'delete',
      '/timetables/tt2/sessions/' + created.body.data[0].sessionId,
      'manager',
      200
    );
    const holiday = await call('post', '/meta/holidays', 'manager', 201, {
      name: 'Institute holiday',
      date: '2026-10-12',
      academicYearId: 'hardening-test',
    });
    const week = await call('get', '/timetables/tt1/occurrences?week=2026-10-12', 'manager', 200);
    assert.equal(
      week.body.data.entries.find((e: any) => e.id === 'lecture').cancellationReason,
      'Holiday: Institute holiday'
    );
    await call('delete', '/meta/holidays/' + holiday.body.data.id, 'manager', 200);
    console.log(checks + ' authenticated API checks passed');
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
