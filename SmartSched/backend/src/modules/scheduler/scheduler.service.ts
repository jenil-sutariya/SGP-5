import { TimetableStatus, PreferenceType } from '@prisma/client';
import prisma from '../../database/prisma';
import { config } from '../../config';
import { NotFoundError, ValidationError } from '../../utils/AppError';
import { EngineContext, SessionRequest } from './scheduler.types';
import { schedulingEngine } from './scheduler.engine';
import { geneticOptimizer, computeRequestPriority } from './scheduler.genetic';
import { conflictService } from '../timetable/conflict.service';

export class SchedulerService {
  async generate(input: {
    academicYearId: string;
    semesterId: string;
    departmentId?: string | null;
    sectionId?: string | null;
    instituteId?: string | null;
    name?: string;
    useGenetic?: boolean;
    createdById?: string;
  }) {
    const semester = await prisma.semester.findUnique({ where: { id: input.semesterId } });
    if (!semester) throw new NotFoundError('Semester');

    // Resolve target department from section if department is not passed directly
    let targetDeptId = input.departmentId;
    if (input.sectionId && !targetDeptId) {
      const sec = await prisma.section.findUnique({
        where: { id: input.sectionId },
        select: { departmentId: true }
      });
      if (sec) {
        targetDeptId = sec.departmentId;
      }
    }

    // Check if there is already a timetable being generated for this department and semester
    const generating = await prisma.timetable.findFirst({
      where: {
        academicYearId: input.academicYearId,
        semesterId: input.semesterId,
        departmentId: targetDeptId || null,
        status: TimetableStatus.GENERATING,
      },
    });

    if (generating) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (generating.updatedAt > tenMinutesAgo) {
        throw new ValidationError('A timetable is already being generated for this department. Please wait for it to complete.');
      } else {
        // Assume stale/hung generation, clean it up
        await prisma.timetable.delete({ where: { id: generating.id } });
      }
    }

    // Clean up any existing timetables for this department and semester
    // (that are in DRAFT or GENERATED status) to ensure there is only one active timetable per department.
    await prisma.timetable.deleteMany({
      where: {
        academicYearId: input.academicYearId,
        semesterId: input.semesterId,
        departmentId: targetDeptId || null,
        status: {
          in: [TimetableStatus.DRAFT, TimetableStatus.GENERATED],
        },
      },
    });

    const timetable = await prisma.timetable.create({
      data: {
        name: input.name ?? `Timetable ${new Date().toISOString().slice(0, 10)}`,
        academicYearId: input.academicYearId,
        semesterId: input.semesterId,
        departmentId: input.departmentId ?? undefined,
        status: TimetableStatus.GENERATING,
        createdById: input.createdById,
      },
    });

    try {
      const ctx = await this.buildContext(input.semesterId, input.departmentId, input.sectionId, input.instituteId);
      if (!ctx.requests.length) {
        throw new ValidationError('No course offerings with faculty assignments found to schedule');
      }

      let result = schedulingEngine.run(ctx);

      if (input.useGenetic !== false) {
        // Dynamically scale down population size and generation count for larger datasets to avoid performance bottlenecks
        const reqCount = ctx.requests.length;
        const popSize = reqCount > 800 ? 4 : reqCount > 300 ? 8 : config.scheduler.populationSize;
        const gens = reqCount > 800 ? 2 : reqCount > 300 ? 5 : Math.min(30, Math.floor(config.scheduler.maxIterations / 200));

        result = geneticOptimizer.optimize(
          ctx,
          result,
          popSize,
          config.scheduler.mutationRate,
          gens
        );
      }

      const entryData = result.assignments.flatMap((a) =>
        a.timeSlotIds.map((timeSlotId) => ({
          timetableId: timetable.id,
          courseOfferingId: a.courseOfferingId,
          facultyId: a.facultyId,
          roomId: a.roomId,
          laboratoryId: a.laboratoryId,
          sectionId: a.sectionId,
          practicalBatchId: a.practicalBatchId || null,
          dayId: a.dayId,
          timeSlotId,
          isLab: a.isLab,
        }))
      );

      // Insert entries ignoring unique conflicts by filtering duplicates
      const seen = new Set<string>();
      const unique = entryData.filter((e) => {
        const k = `${e.dayId}|${e.timeSlotId}|${e.facultyId}|${e.roomId ?? e.laboratoryId}|${e.practicalBatchId ?? ''}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (unique.length) {
        await prisma.timetableEntry.createMany({ data: unique, skipDuplicates: true });
      }

      const conflicts = await conflictService.detectAndPersist(timetable.id);

      const updated = await prisma.timetable.update({
        where: { id: timetable.id },
        data: {
          status: TimetableStatus.GENERATED,
          score: result.score,
          generatedAt: new Date(),
          metadata: {
            assignedSessions: result.assignments.length,
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
            conflictCount: conflicts.length,
          },
        },
        include: {
          entries: {
            include: {
              courseOffering: { include: { subject: true } },
              faculty: { include: { user: true } },
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

      return updated;
    } catch (error) {
      // Use updateMany to avoid P2025 if the timetable record was already deleted/not found
      await prisma.timetable.updateMany({
        where: { id: timetable.id, status: TimetableStatus.GENERATING },
        data: { status: TimetableStatus.DRAFT, metadata: { error: String(error) } },
      });
      throw error;
    }
  }

  async optimize(timetableId: string) {
    const timetable = await prisma.timetable.findUnique({ where: { id: timetableId } });
    if (!timetable) throw new NotFoundError('Timetable');

    await prisma.timetableEntry.deleteMany({ where: { timetableId, isLocked: false } });

    return this.generate({
      academicYearId: timetable.academicYearId,
      semesterId: timetable.semesterId,
      departmentId: timetable.departmentId,
      name: `${timetable.name} (optimized)`,
      useGenetic: true,
    });
  }

  async getStatus(timetableId: string) {
    const timetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
      include: {
        _count: { select: { entries: true, conflicts: true } },
        conflicts: { where: { resolved: false }, take: 50 },
      },
    });
    if (!timetable) throw new NotFoundError('Timetable');
    return timetable;
  }

  async resolveConflicts(timetableId: string) {
    const conflicts = await conflictService.detectAndPersist(timetableId);
    const critical = conflicts.filter((c) => c.severity === 'CRITICAL' || c.severity === 'HIGH');

    for (const conflict of critical) {
      // Unlock and remove secondary overlapping entries (keep first)
      const toRemove = conflict.entryIds.slice(1);
      if (toRemove.length) {
        await prisma.timetableEntry.deleteMany({
          where: { id: { in: toRemove }, isLocked: false },
        });
      }
      await prisma.timetableConflict.updateMany({
        where: { timetableId, type: conflict.type, resolved: false },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }

    const remaining = await conflictService.detectAndPersist(timetableId);
    return { resolved: critical.length, remaining };
  }

  private async buildContext(semesterId: string, departmentId?: string | null, sectionId?: string | null, scopedInstituteId?: string | null): Promise<EngineContext> {
    const depts = await prisma.department.findMany({ select: { id: true, code: true, instituteId: true } });
    const deptCodeMap = new Map(depts.map((d) => [d.id, d.code.toUpperCase()]));
    const deptInstMap = new Map(depts.map((d) => [d.id, d.instituteId]));

    // Resolve target department from section if department is not passed directly
    let activeDeptId = departmentId;
    if (sectionId && !activeDeptId) {
      const sec = await prisma.section.findUnique({
        where: { id: sectionId },
        select: { departmentId: true }
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

    const offerings = await prisma.courseOffering.findMany({
      where: {
        semesterId,
        isActive: true,
        ...(sectionId
          ? { sectionId }                                                    // specific division
          : departmentId
          ? { OR: [{ course: { departmentId } }, { subject: { departmentId } }] }  // specific dept
          : instituteId
          ? { OR: [{ course: { department: { instituteId } } }, { subject: { department: { instituteId } } }] }
          : {}),                                                             // all departments
      },
      include: {
        subject: true,
        course: true,
        section: { include: { practicalBatches: true } },
        assignments: { include: { faculty: true } },
      },
    });

    const [days, timeSlots, rooms, laboratories, constraints] = await Promise.all([
      prisma.day.findMany({
        where: {
          isWorking: true,
          OR: [{ instituteId }, { instituteId: null }],
        },
        orderBy: { order: 'asc' },
      }),
      prisma.timeSlot.findMany({
        where: {
          isActive: true,
          OR: [{ instituteId }, { instituteId: null }],
        },
        orderBy: { order: 'asc' },
      }),
      prisma.room.findMany({
        where: {
          isActive: true,
          ...(activeDeptId
            ? isComputerDept
              ? {
                  OR: [
                    { departmentId: null, building: { instituteId } },
                    { department: { code: { in: ['CSE', 'IT', 'CE'] }, instituteId } }
                  ]
                }
              : {
                  OR: [
                    { departmentId: activeDeptId },
                    { departmentId: null, building: { instituteId } }
                  ]
                }
            : instituteId
            ? { building: { instituteId } }
            : {}),
        },
      }),
      prisma.laboratory.findMany({
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
      prisma.constraint.findMany({ where: { isActive: true } }),
    ]);

    const faculty = await prisma.faculty.findMany({
      where: {
        isActive: true,
        ...(activeDeptId ? { departmentId: activeDeptId } : {}),
      },
      include: {
        user: true,
      },
    });
    const facultyIds = faculty.map((f) => f.id);

    const [availability, preferences] = await Promise.all([
      prisma.facultyAvailability.findMany({ where: { facultyId: { in: facultyIds } } }),
      prisma.facultyPreference.findMany({ where: { facultyId: { in: facultyIds } } }),
    ]);

    const facultyAvailability = new Map<string, Set<string>>();
    for (const a of availability) {
      if (!facultyAvailability.has(a.facultyId)) facultyAvailability.set(a.facultyId, new Set());
      if (a.isAvailable) {
        facultyAvailability.get(a.facultyId)!.add(`${a.dayId}|${a.timeSlotId}`);
      }
    }

    // If faculty has no availability rows, treat as always available (empty set means no restriction in engine)
    for (const fid of facultyIds) {
      if (!facultyAvailability.has(fid)) facultyAvailability.set(fid, new Set());
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
      let primary = offering.assignments.find((a) => a.isPrimary) ?? offering.assignments[0];
      const subject = offering.subject;
      const capacity = offering.section?.capacity ?? offering.maxStudents;
      const deptId = offering.course.departmentId || subject.departmentId;

      if (!primary) {
        const deptFacultyPool = faculty.filter((f) => f.departmentId === deptId);
        if (deptFacultyPool.length > 0) {
          const idx = offering.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % deptFacultyPool.length;
          const assignedFac = deptFacultyPool[idx];
          primary = { facultyId: assignedFac.id, isPrimary: true } as any;
          offering.assignments.push(primary);
        } else {
          continue;
        }
      }

      if (subject.type === 'LAB') {
        // LAB type: Conducted in Laboratories, batch-wise, 2 continuous hours, same professor
        const sessions = 1;
        const consecutive = Math.max(2, subject.labHours || 2);

        const batches = offering.section?.practicalBatches || [];
        if (batches.length > 0) {
          const assignedIds = offering.assignments.map((a) => a.facultyId);
          const deptFacultyPool = faculty.filter((f) => f.departmentId === deptId);

          batches.forEach((batch, idx) => {
            let facultyId = assignedIds[idx];
            if (!facultyId) {
              const usedIds = new Set(assignedIds);
              const extraFaculty = deptFacultyPool.find((f) => !usedIds.has(f.id));
              facultyId = extraFaculty ? extraFaculty.id : primary.facultyId;
            }

            for (let i = 0; i < sessions; i++) {
              const base = {
                courseOfferingId: offering.id,
                subjectId: subject.id,
                subjectCode: subject.code,
                subjectName: subject.name,
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
      faculty.map((f) => [
        f.id,
        f.user ? `${f.user.firstName} ${f.user.lastName}` : 'Professor',
      ])
    );

    return {
      requests,
      workingDays: days.map((d) => ({ id: d.id, order: d.order, name: d.name })),
      timeSlots: timeSlots.map((s) => ({
        id: s.id,
        order: s.order,
        name: s.name,
        isLunchBreak: s.isLunchBreak,
        durationMins: s.durationMins,
      })),
      rooms: rooms.map((r) => ({
        id: r.id,
        capacity: r.capacity,
        departmentId: r.departmentId,
        code: r.code,
      })),
      laboratories: laboratories.map((l) => ({
        id: l.id,
        capacity: l.capacity,
        departmentId: l.departmentId,
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
