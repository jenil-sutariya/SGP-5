import { occurrenceCancellation, teachingDates } from '../timetable/occurrence.rules';
import { randomUUID } from 'node:crypto';
import { facultyNameSelect } from '../timetable/timetable.access';
import { TimetableStatus, PreferenceType, Prisma } from '@prisma/client';
import prisma from '../../database/prisma';
import { config } from '../../config';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/AppError';
import { EngineContext, EngineResult, SessionRequest } from './scheduler.types';
import { schedulingEngine } from './scheduler.engine';
import { geneticOptimizer, computeRequestPriority } from './scheduler.genetic';
import { ConflictService } from '../timetable/conflict.service';

import { activeBookingWhere, minutes, overlaps, withScheduleWrite } from './scheduler.bookings';
import { generationFingerprint } from './scheduler.snapshot';

type GenerateInput = {
  academicYearId: string;
  semesterId: string;
  departmentId?: string | null;
  sectionId?: string | null;
  instituteId?: string | null;
  name?: string;
  useGenetic?: boolean;
  createdById?: string;
};

type PreparedGeneration = {
  input: GenerateInput & { instituteId: string };
  ctx: EngineContext;
  requestedSessions: number;
  fingerprint: string;
};

export class SchedulerService {
  constructor(private db: Prisma.TransactionClient = prisma) {}

  async generate(input: GenerateInput) {
    // Release the database transaction before the expensive scheduling calculation.
    const prepared = await withScheduleWrite(
      (db) => new SchedulerService(db).prepareGeneration(input),
      input.instituteId ?? undefined
    );
    const { ctx } = prepared;
    let result = schedulingEngine.run(ctx);
    if (input.useGenetic !== false) {
      const count = ctx.requests.length;
      result = geneticOptimizer.optimize(
        ctx,
        result,
        count > 800 ? 4 : count > 300 ? 8 : config.scheduler.populationSize,
        config.scheduler.mutationRate,
        count > 800
          ? 2
          : count > 300
            ? 5
            : Math.min(30, Math.floor(config.scheduler.maxIterations / 200))
      );
    }
    if (!result.assignments.length)
      throw new ConflictError(
        'No free slots satisfy the room, lab, faculty and batch requirements. Existing timetables were kept.'
      );

    return withScheduleWrite(async (db) => {
      const writer = new SchedulerService(db);
      const current = await writer.prepareGeneration(input);
      if (current.fingerprint !== prepared.fingerprint) {
        throw new ConflictError(
          'Bookings or scheduling settings changed during generation. No changes were saved. Generate again to use the latest data.'
        );
      }
      return writer.saveGeneration(prepared, result);
    }, prepared.input.instituteId);
  }

  private async prepareGeneration(input: GenerateInput): Promise<PreparedGeneration> {
    const semester = await this.db.semester.findUnique({ where: { id: input.semesterId } });
    if (!semester) throw new NotFoundError('Semester');
    if (semester.academicYearId !== input.academicYearId)
      throw new ValidationError('Semester must belong to the selected academic year');
    let targetDeptId = input.departmentId;
    if (input.sectionId) {
      const section = await this.db.section.findUnique({ where: { id: input.sectionId } });
      if (!section) throw new NotFoundError('Section');
      if (section.semesterId !== input.semesterId)
        throw new ValidationError('Section must belong to the selected semester');
      if (targetDeptId && targetDeptId !== section.departmentId)
        throw new ValidationError('Section must belong to the selected department');
      targetDeptId = section.departmentId;
    }
    if (targetDeptId) {
      const department = await this.db.department.findUnique({ where: { id: targetDeptId } });
      if (!department) throw new NotFoundError('Department');
      if (input.instituteId && input.instituteId !== department.instituteId)
        throw new ValidationError('Department must belong to the selected institute');
      input = { ...input, departmentId: targetDeptId, instituteId: department.instituteId };
    }
    if (!input.instituteId)
      throw new ValidationError('Select an institute or department before generating a timetable');
    const ctx = await this.buildContext(
      input.semesterId,
      input.departmentId,
      input.sectionId,
      input.instituteId
    );
    if (!ctx.requests.length)
      throw new ValidationError('No active course offerings found to schedule');
    const requestedSessions = ctx.requests.length;
    const previous = await this.db.timetableEntry.findMany({
      where: { timetable: activeBookingWhere(semester) },
      include: { day: true, timeSlot: true, timetable: { select: { semesterId: true } } },
      orderBy: { id: 'asc' },
    });
    // Project physical booking intervals onto this institute's calendar periods.
    ctx.existingBookings = [];
    ctx.existingFacultyLoad = [];
    for (const entry of previous) {
      const day = ctx.workingDays.find((d) => d.name === entry.day.name);
      if (!day) {
        ctx.existingFacultyLoad.push({
          facultyId: entry.facultyId,
          dayId: entry.dayId,
          hours: (minutes(entry.timeSlot.endTime) - minutes(entry.timeSlot.startTime)) / 60,
        });
        continue;
      }
      ctx.existingFacultyLoad.push({
        facultyId: entry.facultyId,
        dayId: day.id,
        hours: (minutes(entry.timeSlot.endTime) - minutes(entry.timeSlot.startTime)) / 60,
      });
      for (const slot of ctx.timeSlots) {
        if (overlaps(entry.timeSlot, { startTime: slot.startTime!, endTime: slot.endTime! })) {
          ctx.existingBookings.push({ ...entry, dayId: day.id, timeSlotId: slot.id });
        }
      }
    }
    // Capture all requirements, including sessions already satisfied by saved entries.
    const fingerprint = generationFingerprint({
      input,
      semester,
      context: ctx,
      bookings: previous,
    });
    // Count completed sessions, not just timetable headers. Never schedule a saved session twice.
    const savedPeriods = new Map<string, number>();
    for (const entry of previous) {
      if (entry.timetable.semesterId !== input.semesterId) continue;
      const key = entry.courseOfferingId + '|' + (entry.practicalBatchId || '');
      savedPeriods.set(key, (savedPeriods.get(key) ?? 0) + 1);
    }
    const requestedKeys = new Set(
      ctx.requests.map((r) => r.courseOfferingId + '|' + (r.practicalBatchId || ''))
    );
    ctx.requests = ctx.requests.filter((request) => {
      const key = request.courseOfferingId + '|' + (request.practicalBatchId || '');
      const saved = savedPeriods.get(key) ?? 0;
      if (!saved) return true;
      if (saved < request.consecutiveSlots)
        throw new ConflictError(
          'An existing multi-period session is incomplete. Repair it before generating more sessions.'
        );
      savedPeriods.set(key, saved - request.consecutiveSlots);
      return false;
    });
    if ([...savedPeriods].some(([key, remaining]) => remaining > 0 && requestedKeys.has(key))) {
      throw new ConflictError(
        'Existing sessions exceed the current teaching requirements. Review saved timetables first.'
      );
    }
    if (!ctx.requests.length)
      throw new ConflictError(
        'All requested sessions are already scheduled. Existing timetables were kept.'
      );
    return {
      input: { ...input, instituteId: input.instituteId },
      ctx,
      requestedSessions,
      fingerprint,
    };
  }

  private async saveGeneration(prepared: PreparedGeneration, result: EngineResult) {
    const { input, ctx, requestedSessions } = prepared;
    // Reuse an unpublished timetable with the exact same requested scope, when available.
    const existing = await this.db.timetable.findFirst({
      where: {
        semesterId: input.semesterId,
        departmentId: input.departmentId || null,
        status: TimetableStatus.GENERATED,
        AND: [
          { metadata: { path: ['instituteId'], equals: input.instituteId } },
          { metadata: { path: ['sectionId'], equals: input.sectionId || '' } },
        ],
      },
    });
    const timetable =
      existing ||
      (await this.db.timetable.create({
        data: {
          name: input.name || 'Timetable ' + new Date().toISOString().slice(0, 10),
          academicYearId: input.academicYearId,
          semesterId: input.semesterId,
          departmentId: input.departmentId,
          instituteId: input.instituteId,
          status: TimetableStatus.GENERATING,
          createdById: input.createdById,
        },
      }));
    const entryData = result.assignments.flatMap((a) => {
      const sessionId = randomUUID();
      return a.timeSlotIds.map((timeSlotId) => ({
        timetableId: timetable.id,
        sessionId,
        courseOfferingId: a.courseOfferingId,
        facultyId: a.facultyId,
        roomId: a.roomId,
        laboratoryId: a.laboratoryId,
        sectionId: a.sectionId,
        practicalBatchId: a.practicalBatchId || null,
        dayId: a.dayId,
        timeSlotId,
        isLab: a.isLab,
      }));
    });
    // A duplicate is an error: rollback the whole operation instead of silently losing periods.
    await this.db.timetableEntry.createMany({ data: entryData });
    const conflicts = await new ConflictService(this.db).detectAndPersist(timetable.id);
    if (conflicts.length)
      throw new ConflictError(
        'Generated entries failed conflict validation; no changes were saved.',
        conflicts
      );
    return this.db.timetable.update({
      where: { id: timetable.id },
      data: {
        status: TimetableStatus.GENERATED,
        score: result.score,
        generatedAt: new Date(),
        metadata: {
          instituteId: input.instituteId,
          sectionId: input.sectionId || '',
          preservedSessions: requestedSessions - ctx.requests.length,
          assignedSessions: requestedSessions - result.unassigned.length,
          unassignedSessions: result.unassigned.length,
          unassigned: result.unassigned.map((u) => ({
            subjectCode: u.subjectCode,
            subjectName: u.subjectName,
            facultyId: u.facultyId,
            facultyName: ctx.facultyNames?.get(u.facultyId) || 'Professor',
            sectionId: u.sectionId,
            practicalBatchId: u.practicalBatchId || null,
            isLab: u.isLab,
          })),
          iterations: result.iterations,
          conflictCount: 0,
        },
      },
      include: {
        entries: {
          include: {
            courseOffering: { include: { subject: true } },
            faculty: { include: { user: { select: facultyNameSelect } } },
            room: true,
            laboratory: true,
            day: true,
            timeSlot: true,
            section: true,
          },
        },
        conflicts: true,
      },
    });
  }

  async optimize(timetableId: string) {
    const timetable = await this.db.timetable.findUnique({ where: { id: timetableId } });
    if (!timetable) throw new NotFoundError('Timetable');

    return this.generate({
      academicYearId: timetable.academicYearId,
      semesterId: timetable.semesterId,
      departmentId: timetable.departmentId,
      name: timetable.name,
      sectionId: (timetable.metadata as { sectionId?: string } | null)?.sectionId || undefined,
      useGenetic: true,
      instituteId: timetable.instituteId,
    });
  }

  async getStatus(timetableId: string) {
    const timetable = await this.db.timetable.findUnique({
      where: { id: timetableId },
      include: {
        _count: { select: { entries: true, conflicts: true } },
        conflicts: { where: { resolved: false }, take: 50 },
      },
    });
    if (!timetable) throw new NotFoundError('Timetable');
    return timetable;
  }

  private async buildContext(
    semesterId: string,
    departmentId?: string | null,
    sectionId?: string | null,
    scopedInstituteId?: string | null
  ): Promise<EngineContext> {
    const depts = await this.db.department.findMany({
      select: { id: true, code: true, instituteId: true },
      orderBy: { id: 'asc' },
    });
    const deptCodeMap = new Map(depts.map((d) => [d.id, d.code.toUpperCase()]));
    const deptInstMap = new Map(depts.map((d) => [d.id, d.instituteId]));

    // Resolve target department from section if department is not passed directly
    let activeDeptId = departmentId;
    if (sectionId && !activeDeptId) {
      const sec = await this.db.section.findUnique({
        where: { id: sectionId },
        select: { departmentId: true },
      });
      if (sec) {
        activeDeptId = sec.departmentId;
      }
    }

    let instituteId: string | undefined = scopedInstituteId ?? undefined;
    let isComputerDept = false;
    if (activeDeptId) {
      const dept = depts.find((d) => d.id === activeDeptId);
      if (dept) {
        const deptCode = dept.code.toUpperCase();
        isComputerDept = ['CSE', 'IT', 'CE'].includes(deptCode);
        if (!instituteId) instituteId = dept.instituteId;
      }
    }

    const offerings = await this.db.courseOffering.findMany({
      where: {
        semesterId,
        isActive: true,
        ...(sectionId
          ? { sectionId } // specific division
          : departmentId
            ? { section: { departmentId } } // divisions belonging to the selected department
            : instituteId
              ? {
                  OR: [
                    { course: { department: { instituteId } } },
                    { subject: { department: { instituteId } } },
                  ],
                }
              : {}), // all departments
      },
      include: {
        subject: { include: { requirements: true } },
        course: true,
        section: {
          include: {
            practicalBatches: { where: { isActive: true }, orderBy: { id: 'asc' } },
            batch: true,
          },
        },
        assignments: { include: { faculty: true }, orderBy: { id: 'asc' } },
      },
      orderBy: { id: 'asc' },
    });

    const [days, timeSlots, rooms, laboratories, constraints] = await Promise.all([
      this.db.day.findMany({
        where: {
          isWorking: true,
          OR: [{ instituteId }, { instituteId: null }],
        },
        orderBy: { order: 'asc' },
      }),
      this.db.timeSlot.findMany({
        where: {
          isActive: true,
          OR: [{ instituteId }, { instituteId: null }],
        },
        orderBy: { order: 'asc' },
      }),
      this.db.room.findMany({
        include: { building: true },
        orderBy: { id: 'asc' },
        where: {
          isActive: true,
          ...(activeDeptId
            ? isComputerDept
              ? {
                  OR: [
                    { departmentId: null, building: { instituteId } },
                    { department: { code: { in: ['CSE', 'IT', 'CE'] }, instituteId } },
                  ],
                }
              : {
                  OR: [
                    { departmentId: activeDeptId },
                    { departmentId: null, building: { instituteId } },
                  ],
                }
            : instituteId
              ? { building: { instituteId } }
              : {}),
        },
      }),
      this.db.laboratory.findMany({
        include: { building: true },
        orderBy: { id: 'asc' },
        where: {
          isActive: true,
          ...(activeDeptId
            ? isComputerDept
              ? { department: { code: { in: ['CSE', 'IT', 'CE'] }, instituteId } }
              : { departmentId: activeDeptId }
            : instituteId
              ? { department: { instituteId } }
              : {}),
        },
      }),
      this.db.constraint.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    ]);

    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      if (minutes(slot.endTime) <= minutes(slot.startTime))
        throw new ValidationError('Time slot end must be after its start');
      for (const other of timeSlots.slice(i + 1)) {
        if (overlaps(slot, other))
          throw new ValidationError(
            'Calendar periods overlap. Fix time slots before generating a timetable.'
          );
      }
    }

    const faculty = await this.db.faculty.findMany({
      where: {
        isActive: true,
        department: { instituteId },
      },
      include: {
        user: true,
      },
      orderBy: { id: 'asc' },
    });
    const facultyIds = faculty.map((f) => f.id);
    const semester = await this.db.semester.findUniqueOrThrow({ where: { id: semesterId } });
    const [holidays, leaves] = await Promise.all([
      this.db.holiday.findMany({
        where: {
          AND: [
            { OR: [{ instituteId }, { instituteId: null }] },
            { OR: [{ academicYearId: semester.academicYearId }, { isRecurring: true }] },
          ],
        },
        orderBy: { id: 'asc' },
      }),
      this.db.facultyLeave.findMany({
        where: {
          facultyId: { in: facultyIds },
          status: 'APPROVED',
          startDate: { lte: semester.endDate },
          endDate: { gte: semester.startDate },
        },
        orderBy: { id: 'asc' },
      }),
    ]);
    const calendarExceptions = { holidays, leaves };
    const facultyTeachingDays = new Map(
      facultyIds.map((facultyId) => [
        facultyId,
        new Set(
          days
            .filter((day) =>
              teachingDates(semester, day.name).some(
                (date) =>
                  !occurrenceCancellation(
                    date,
                    instituteId!,
                    semester.academicYearId,
                    facultyId,
                    calendarExceptions
                  )
              )
            )
            .map((day) => day.id)
        ),
      ])
    );

    const [availability, preferences] = await Promise.all([
      this.db.facultyAvailability.findMany({
        where: { facultyId: { in: facultyIds } },
        orderBy: { id: 'asc' },
      }),
      this.db.facultyPreference.findMany({
        where: { facultyId: { in: facultyIds } },
        orderBy: { id: 'asc' },
      }),
    ]);

    const facultyAvailability = new Map<string, Set<string>>();
    for (const fid of facultyIds) {
      const rows = availability.filter((a) => a.facultyId === fid);
      const allowed = new Set(
        days.flatMap((day) =>
          timeSlots.filter((slot) => !slot.isLunchBreak).map((slot) => day.id + '|' + slot.id)
        )
      );
      for (const row of rows) {
        const key = row.dayId + '|' + row.timeSlotId;
        if (!row.isAvailable) allowed.delete(key);
      }
      facultyAvailability.set(fid, allowed);
    }

    const facultyPreferences = new Map<string, { key: string; type: string; weight: number }[]>();
    for (const p of preferences) {
      if (!facultyPreferences.has(p.facultyId)) facultyPreferences.set(p.facultyId, []);
      facultyPreferences.get(p.facultyId)!.push({
        key: `${p.dayId ?? ''}|${p.timeSlotId ?? ''}`,
        type: p.preferenceType,
        weight: p.weight,
      });
      if (p.preferenceType === PreferenceType.UNAVAILABLE && p.dayId && p.timeSlotId) {
        const set = facultyAvailability.get(p.facultyId);
        set?.delete(`${p.dayId}|${p.timeSlotId}`);
      }
    }

    const facultyMaxPerDay = new Map(faculty.map((f) => [f.id, f.maxHoursPerDay]));
    const facultyMaxPerWeek = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek]));

    const requests: SessionRequest[] = [];
    let reqCounter = 0;

    for (const offering of offerings) {
      if (
        !offering.section ||
        !offering.section.isActive ||
        !offering.course.isActive ||
        !offering.subject.isActive
      ) {
        throw new ValidationError(
          'Every course offering needs an active subject, course and division before scheduling'
        );
      }
      if (offering.assignments.some((a) => !a.faculty.isActive))
        throw new ValidationError('Replace inactive faculty assignments before scheduling');
      const ownerDeptId = offering.section?.departmentId || offering.course.departmentId;
      const ownerInstitute = deptInstMap.get(ownerDeptId);
      if (
        !ownerInstitute ||
        ownerInstitute !== instituteId ||
        deptInstMap.get(offering.course.departmentId) !== ownerInstitute ||
        deptInstMap.get(offering.subject.departmentId) !== ownerInstitute ||
        (offering.section?.batch && offering.section.batch.instituteId !== ownerInstitute) ||
        offering.assignments.some((a) => deptInstMap.get(a.faculty.departmentId) !== ownerInstitute)
      ) {
        throw new ValidationError(
          'Course offering, batch, subject and faculty must belong to the selected institute'
        );
      }
      let primary = offering.assignments.find((a) => a.isPrimary) ?? offering.assignments[0];
      const subject = offering.subject;
      const capacity = offering.section?.capacity ?? offering.maxStudents;
      const deptId = ownerDeptId;

      if (!primary)
        throw new ValidationError(
          'Assign a faculty member to ' + subject.code + ' before generation'
        );

      if (subject.type === 'LAB') {
        // LAB type: Conducted in Laboratories, batch-wise, 2 continuous hours, same professor
        const sessions = 1;
        const consecutive = Math.max(2, subject.labHours || 2);

        const batches = offering.section?.practicalBatches || [];
        if (batches.length > 0) {
          const assignedIds = offering.assignments.map((a) => a.facultyId);

          batches.forEach((batch, idx) => {
            let facultyId = assignedIds[idx];
            if (!facultyId) facultyId = primary.facultyId;

            for (let i = 0; i < sessions; i++) {
              const base = {
                courseOfferingId: offering.id,
                subjectId: subject.id,
                subjectCode: subject.code,
                subjectName: subject.name,
                venueRequirements: subject.requirements,
                subjectType: 'LAB',
                difficulty: subject.difficulty,
                facultyId,
                sectionId: offering.sectionId,
                practicalBatchId: batch.id,
                departmentId: deptId,
                isLab: true,
                consecutiveSlots: consecutive,
                requiredCapacity: batch.capacity || 20,
              };
              const id = `req-${++reqCounter}`;
              requests.push({
                id,
                ...base,
                priority: computeRequestPriority({ id, ...base }),
              });
            }
          });
        } else {
          for (let i = 0; i < sessions; i++) {
            const base = {
              courseOfferingId: offering.id,
              subjectId: subject.id,
              subjectCode: subject.code,
              subjectName: subject.name,
              venueRequirements: subject.requirements,
              subjectType: 'LAB',
              difficulty: subject.difficulty,
              facultyId: primary.facultyId,
              sectionId: offering.sectionId,
              practicalBatchId: null,
              departmentId: deptId,
              isLab: true,
              consecutiveSlots: consecutive,
              requiredCapacity: capacity,
            };
            const id = `req-${++reqCounter}`;
            requests.push({
              id,
              ...base,
              priority: computeRequestPriority({ id, ...base }),
            });
          }
        }
      } else if (subject.type === 'PRACTICAL') {
        // PRACTICAL type: Conducted in Classrooms.
        // If 1 hr per week -> 1 single lecture (1 hr) in classroom.
        // If >= 2 hr per week -> 2 continuous hours in classroom with NO professor change.
        const hoursPerWeek = subject.weeklyHours || subject.labHours || 2;
        const consecutive = hoursPerWeek === 1 ? 1 : 2;

        const base = {
          courseOfferingId: offering.id,
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          venueRequirements: subject.requirements,
          subjectType: 'PRACTICAL',
          difficulty: subject.difficulty,
          facultyId: primary.facultyId,
          sectionId: offering.sectionId,
          practicalBatchId: null,
          departmentId: deptId,
          isLab: false,
          consecutiveSlots: consecutive,
          requiredCapacity: capacity,
        };
        const id = `req-${++reqCounter}`;
        requests.push({
          id,
          ...base,
          priority: computeRequestPriority({ id, ...base }),
        });
      } else {
        // THEORY / TUTORIAL / Default type: Conducted in Classrooms (1 hr per session)
        for (let i = 0; i < subject.weeklyHours; i++) {
          const base = {
            courseOfferingId: offering.id,
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            venueRequirements: subject.requirements,
            subjectType: subject.type || 'THEORY',
            difficulty: subject.difficulty,
            facultyId: primary.facultyId,
            sectionId: offering.sectionId,
            practicalBatchId: null,
            departmentId: deptId,
            isLab: false,
            consecutiveSlots: 1,
            requiredCapacity: capacity,
          };
          const id = `req-${++reqCounter}`;
          requests.push({
            id,
            ...base,
            priority: computeRequestPriority({ id, ...base }),
          });
        }
      }
    }

    const facultyNamesMap = new Map(
      faculty.map((f) => [f.id, f.user ? `${f.user.firstName} ${f.user.lastName}` : 'Professor'])
    );

    return {
      requests,
      facultyTeachingDays,
      calendarExceptions,
      workingDays: days.map((d) => ({ id: d.id, order: d.order, name: d.name })),
      timeSlots: timeSlots.map((s) => ({
        id: s.id,
        order: s.order,
        name: s.name,
        isLunchBreak: s.isLunchBreak,
        durationMins: minutes(s.endTime) - minutes(s.startTime),
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      rooms: rooms
        .filter(
          (r) =>
            r.building.instituteId === instituteId &&
            (!r.departmentId || deptInstMap.get(r.departmentId) === instituteId)
        )
        .map((r) => ({
          id: r.id,
          capacity: r.capacity,
          roomTypeId: r.roomTypeId,
          equipment: r.equipment,
          hasProjector: r.hasProjector,
          hasAC: r.hasAC,
          hasWhiteboard: r.hasWhiteboard,
          departmentId: r.departmentId,
          instituteId: r.building.instituteId,
          code: r.code,
        })),
      laboratories: laboratories
        .filter(
          (l) =>
            l.building.instituteId === instituteId &&
            deptInstMap.get(l.departmentId) === instituteId
        )
        .map((l) => ({
          id: l.id,
          capacity: l.capacity,
          roomTypeId: l.roomTypeId,
          equipment: l.equipment,
          departmentId: l.departmentId,
          instituteId: l.building.instituteId,
          code: l.code,
        })),
      facultyAvailability,
      facultyPreferences,
      facultyMaxPerDay,
      facultyMaxPerWeek,
      softConstraints: constraints
        .filter((c) => c.type === 'SOFT')
        .map((c) => ({
          name: c.name,
          weight: c.weight,
          config: (c.config as Record<string, unknown>) ?? {},
        })),
      maxIterations: config.scheduler.maxIterations,
      departmentCodes: deptCodeMap,
      departmentInstitutes: deptInstMap,
      facultyNames: facultyNamesMap,
    };
  }
}

export const schedulerService = new SchedulerService();
