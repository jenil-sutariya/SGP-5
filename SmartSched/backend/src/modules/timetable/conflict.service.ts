import { ConflictSeverity } from '@prisma/client';
import prisma from '../../database/prisma';

export interface ConflictResult {
  type: string;
  severity: ConflictSeverity;
  description: string;
  entryIds: string[];
}

export class ConflictService {
  async detect(timetableId: string): Promise<ConflictResult[]> {
    const entries = await prisma.timetableEntry.findMany({
      where: { timetableId },
      include: {
        faculty: { include: { user: true } },
        room: true,
        laboratory: true,
        section: true,
        practicalBatch: true,
        day: true,
        timeSlot: true,
        courseOffering: { include: { subject: true } },
      },
    });

    const conflicts: ConflictResult[] = [];
    const key = (dayId: string, slotId: string, resourceId: string) => `${dayId}|${slotId}|${resourceId}`;

    const facultyMap = new Map<string, typeof entries>();
    const roomMap = new Map<string, typeof entries>();
    const labMap = new Map<string, typeof entries>();
    const sectionMap = new Map<string, typeof entries>();

    for (const e of entries) {
      const fk = key(e.dayId, e.timeSlotId, e.facultyId);
      if (!facultyMap.has(fk)) facultyMap.set(fk, []);
      facultyMap.get(fk)!.push(e);

      if (e.roomId) {
        const rk = key(e.dayId, e.timeSlotId, e.roomId);
        if (!roomMap.has(rk)) roomMap.set(rk, []);
        roomMap.get(rk)!.push(e);
      }
      if (e.laboratoryId) {
        const lk = key(e.dayId, e.timeSlotId, e.laboratoryId);
        if (!labMap.has(lk)) labMap.set(lk, []);
        labMap.get(lk)!.push(e);
      }
      if (e.sectionId) {
        const sk = key(e.dayId, e.timeSlotId, e.sectionId);
        if (!sectionMap.has(sk)) sectionMap.set(sk, []);
        sectionMap.get(sk)!.push(e);
      }
    }

    for (const [, group] of facultyMap) {
      if (group.length > 1) {
        conflicts.push({
          type: 'FACULTY_CLASH',
          severity: ConflictSeverity.CRITICAL,
          description: `Faculty ${group[0].faculty.user.firstName} ${group[0].faculty.user.lastName} double-booked on ${group[0].day.name} ${group[0].timeSlot.name}`,
          entryIds: group.map((g) => g.id),
        });
      }
    }

    for (const [, group] of roomMap) {
      if (group.length > 1) {
        conflicts.push({
          type: 'ROOM_CLASH',
          severity: ConflictSeverity.CRITICAL,
          description: `Room ${group[0].room?.code} overlapped on ${group[0].day.name} ${group[0].timeSlot.name}`,
          entryIds: group.map((g) => g.id),
        });
      }
    }

    // LAB_CLASH: Multiple entries can share a lab simultaneously as long as lab capacity is not exceeded
    for (const [, group] of labMap) {
      if (group.length > 1) {
        const lab = group[0].laboratory;
        if (lab) {
          let totalCapacity = 0;
          for (const e of group) {
            totalCapacity += e.practicalBatch?.capacity ?? e.section?.capacity ?? e.courseOffering.maxStudents;
          }
          if (totalCapacity > lab.capacity) {
            conflicts.push({
              type: 'LAB_OVERFLOW_CLASH',
              severity: ConflictSeverity.CRITICAL,
              description: `Lab ${lab.code} (capacity ${lab.capacity}) overloaded with combined ${totalCapacity} students on ${group[0].day.name} ${group[0].timeSlot.name}`,
              entryIds: group.map((g) => g.id),
            });
          }
        }
      }
    }

    // SECTION_CLASH & BATCH_CLASH
    for (const [, group] of sectionMap) {
      if (group.length > 1) {
        const hasTheory = group.some((e) => !e.isLab || !e.practicalBatchId);
        if (hasTheory) {
          conflicts.push({
            type: 'SECTION_CLASH',
            severity: ConflictSeverity.HIGH,
            description: `Section ${group[0].section?.code} has overlapping theory/practical classes on ${group[0].day.name} ${group[0].timeSlot.name}`,
            entryIds: group.map((g) => g.id),
          });
        } else {
          // Verify batch-level double booking
          const batchMap = new Map<string, typeof entries>();
          for (const e of group) {
            if (e.practicalBatchId) {
              if (!batchMap.has(e.practicalBatchId)) batchMap.set(e.practicalBatchId, []);
              batchMap.get(e.practicalBatchId)!.push(e);
            }
          }
          for (const [batchId, batchGroup] of batchMap) {
            if (batchGroup.length > 1) {
              const batchName = batchGroup[0].practicalBatch?.name ?? batchId;
              conflicts.push({
                type: 'BATCH_CLASH',
                severity: ConflictSeverity.HIGH,
                description: `Batch ${batchName} of Section ${group[0].section?.code} has overlapping practicals on ${group[0].day.name} ${group[0].timeSlot.name}`,
                entryIds: batchGroup.map((g) => g.id),
              });
            }
          }
        }
      }
    }

    // Capacity checks
    for (const e of entries) {
      const capacityNeeded = e.practicalBatch?.capacity ?? e.section?.capacity ?? e.courseOffering.maxStudents;
      if (e.roomId && e.room && e.room.capacity < capacityNeeded) {
        conflicts.push({
          type: 'ROOM_CAPACITY',
          severity: ConflictSeverity.MEDIUM,
          description: `Room ${e.room.code} capacity ${e.room.capacity} < required ${capacityNeeded}`,
          entryIds: [e.id],
        });
      }
      if (e.laboratoryId && e.laboratory && e.laboratory.capacity < capacityNeeded) {
        conflicts.push({
          type: 'LAB_CAPACITY',
          severity: ConflictSeverity.MEDIUM,
          description: `Lab ${e.laboratory.code} capacity ${e.laboratory.capacity} < required ${capacityNeeded}`,
          entryIds: [e.id],
        });
      }
      if (e.isLab && !e.laboratoryId) {
        conflicts.push({
          type: 'LAB_REQUIRED',
          severity: ConflictSeverity.HIGH,
          description: `Lab session for ${e.courseOffering.subject.code} missing laboratory assignment`,
          entryIds: [e.id],
        });
      }
    }

    // Max lectures per faculty per day
    const facultyDayCount = new Map<string, { count: number; max: number; entries: string[]; name: string; day: string }>();
    for (const e of entries) {
      const k = `${e.facultyId}|${e.dayId}`;
      const cur = facultyDayCount.get(k) ?? {
        count: 0,
        max: e.faculty.maxHoursPerDay,
        entries: [],
        name: `${e.faculty.user.firstName} ${e.faculty.user.lastName}`,
        day: e.day.name,
      };
      cur.count += 1;
      cur.entries.push(e.id);
      facultyDayCount.set(k, cur);
    }
    for (const [, v] of facultyDayCount) {
      if (v.count > v.max) {
        conflicts.push({
          type: 'FACULTY_DAILY_OVERLOAD',
          severity: ConflictSeverity.MEDIUM,
          description: `${v.name} has ${v.count} lectures on ${v.day} (max ${v.max})`,
          entryIds: v.entries,
        });
      }
    }

    return conflicts;
  }

  async detectAndPersist(timetableId: string) {
    const conflicts = await this.detect(timetableId);
    await prisma.timetableConflict.deleteMany({ where: { timetableId, resolved: false } });
    if (conflicts.length) {
      await prisma.timetableConflict.createMany({
        data: conflicts.map((c) => ({
          timetableId,
          type: c.type,
          severity: c.severity,
          description: c.description,
          entryIds: c.entryIds,
        })),
      });
    }
    return conflicts;
  }
}

export const conflictService = new ConflictService();
