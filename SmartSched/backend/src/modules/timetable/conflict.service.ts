import { teachingDates, occurrenceCancellation, weekMonday } from './occurrence.rules';
import { venueSatisfies } from '../scheduler/venue.rules';
import { facultyNameSelect } from './timetable.access';
import { ConflictSeverity, Prisma } from '@prisma/client';
import prisma from '../../database/prisma';
import { NotFoundError } from '../../utils/AppError';
import { activeBookingWhere, minutes, overlaps } from '../scheduler/scheduler.bookings';

export interface ConflictResult {
  type: string;
  severity: ConflictSeverity;
  description: string;
  entryIds: string[];
}

export class ConflictService {
  constructor(private db: Prisma.TransactionClient = prisma) {}

  async detect(timetableId: string): Promise<ConflictResult[]> {
    const timetable = await this.db.timetable.findUnique({
      where: { id: timetableId },
      include: { semester: true },
    });
    if (!timetable) throw new NotFoundError('Timetable');
    const entries = await this.db.timetableEntry.findMany({
      where: { OR: [{ timetableId }, { timetable: activeBookingWhere(timetable.semester) }] },
      include: {
        faculty: { include: { user: { select: facultyNameSelect } } },
        room: true,
        laboratory: true,
        section: true,
        practicalBatch: true,
        day: true,
        timeSlot: true,
        courseOffering: { include: { subject: { include: { requirements: true } } } },
        timetable: { include: { semester: true } },
      },
    });
    const [holidays, leaves] = await Promise.all([
      this.db.holiday.findMany(),
      this.db.facultyLeave.findMany({
        where: {
          status: 'APPROVED',
          facultyId: { in: [...new Set(entries.map((e) => e.facultyId))] },
        },
      }),
    ]);
    const activeDates = new Map(
      entries.map((entry) => [
        entry.id,
        new Set(
          teachingDates(entry.timetable.semester, entry.day.name).filter(
            (date) =>
              !occurrenceCancellation(
                date,
                entry.timetable.instituteId,
                entry.timetable.academicYearId,
                entry.facultyId,
                { holidays, leaves }
              )
          )
        ),
      ])
    );
    const conflicts: ConflictResult[] = [];
    const targetIds = new Set(
      entries.filter((e) => e.timetableId === timetableId).map((e) => e.id)
    );
    const add = (type: string, description: string, ids: string[]) => {
      if (ids.some((id) => targetIds.has(id)))
        conflicts.push({ type, severity: ConflictSeverity.HIGH, description, entryIds: ids });
    };
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i];
      for (const b of entries.slice(i + 1)) {
        if (!targetIds.has(a.id) && !targetIds.has(b.id)) continue;
        if (a.day.name !== b.day.name || !overlaps(a.timeSlot, b.timeSlot)) continue;
        if (
          a.timetable.semester.startDate > b.timetable.semester.endDate ||
          b.timetable.semester.startDate > a.timetable.semester.endDate
        )
          continue;
        if (![...activeDates.get(a.id)!].some((date) => activeDates.get(b.id)!.has(date))) continue;
        const when = a.day.name + ' ' + a.timeSlot.startTime + '–' + a.timeSlot.endTime;
        const ids = [a.id, b.id];
        if (a.facultyId === b.facultyId)
          add(
            'FACULTY_CLASH',
            'Faculty ' + a.faculty.user.firstName + ' is double-booked on ' + when,
            ids
          );
        if (a.roomId && a.roomId === b.roomId)
          add('ROOM_CLASH', 'Classroom ' + a.room?.code + ' is double-booked on ' + when, ids);
        if (a.laboratoryId && a.laboratoryId === b.laboratoryId)
          add(
            'LAB_CLASH',
            'Laboratory ' + a.laboratory?.code + ' is double-booked on ' + when,
            ids
          );
        if (a.practicalBatchId && a.practicalBatchId === b.practicalBatchId)
          add('BATCH_CLASH', 'Practical batch is double-booked on ' + when, ids);
        if (
          a.sectionId &&
          a.sectionId === b.sectionId &&
          (!a.practicalBatchId || !b.practicalBatchId)
        ) {
          add(
            'SECTION_CLASH',
            'Division ' + a.section?.code + ' has overlapping classes on ' + when,
            ids
          );
        }
      }
      const venue = a.room || a.laboratory;
      if (venue && !venueSatisfies(venue, 0, a.courseOffering.subject.requirements))
        add(
          'VENUE_REQUIREMENTS',
          'Venue does not meet subject equipment, capacity or room-type requirements',
          [a.id]
        );
      const needed =
        a.practicalBatch?.capacity ?? a.section?.capacity ?? a.courseOffering.maxStudents;
      if (a.room && a.room.capacity < needed)
        add('ROOM_CAPACITY', 'Classroom capacity is below ' + needed, [a.id]);
      if (a.laboratory && a.laboratory.capacity < needed)
        add('LAB_CAPACITY', 'Laboratory capacity is below ' + needed, [a.id]);
      if (a.courseOffering.subject.type === 'LAB' && (!a.laboratoryId || a.roomId))
        add('LAB_REQUIRED', 'Lab teaching requires a laboratory', [a.id]);
      if (a.courseOffering.subject.type !== 'LAB' && (!a.roomId || a.laboratoryId))
        add('ROOM_REQUIRED', 'This session requires a classroom', [a.id]);
      if (a.timeSlot.isLunchBreak || !a.day.isWorking || !a.timeSlot.isActive)
        add('INVALID_PERIOD', 'Session uses a break or inactive calendar period', [a.id]);
    }
    const targetFaculty = [
      ...new Set(entries.filter((e) => targetIds.has(e.id)).map((e) => e.facultyId)),
    ];
    const [availability, preferences] = await Promise.all([
      this.db.facultyAvailability.findMany({
        where: { facultyId: { in: targetFaculty }, isAvailable: false },
      }),
      this.db.facultyPreference.findMany({
        where: { facultyId: { in: targetFaculty }, preferenceType: 'UNAVAILABLE' },
      }),
    ]);
    for (const e of entries.filter((e) => targetIds.has(e.id))) {
      if (
        availability.some(
          (a) => a.facultyId === e.facultyId && a.dayId === e.dayId && a.timeSlotId === e.timeSlotId
        ) ||
        preferences.some(
          (p) =>
            p.facultyId === e.facultyId &&
            (!p.dayId || p.dayId === e.dayId) &&
            (!p.timeSlotId || p.timeSlotId === e.timeSlotId)
        )
      ) {
        add('FACULTY_UNAVAILABLE', 'Faculty is unavailable during this period', [e.id]);
      }
    }
    for (const facultyId of targetFaculty) {
      const facultyEntries = entries.filter((e) => e.facultyId === facultyId);
      const hours = (list: typeof entries) =>
        list.reduce(
          (sum, e) => sum + (minutes(e.timeSlot.endTime) - minutes(e.timeSlot.startTime)) / 60,
          0
        );
      const daily = new Map<string, typeof entries>();
      const weekly = new Map<string, typeof entries>();
      for (const entry of facultyEntries)
        for (const date of activeDates.get(entry.id)!) {
          daily.set(date, [...(daily.get(date) || []), entry]);
          const week = weekMonday(date);
          weekly.set(week, [...(weekly.get(week) || []), entry]);
        }
      if (
        [...weekly.values()].some((list) => hours(list) > facultyEntries[0].faculty.maxHoursPerWeek)
      )
        add(
          'FACULTY_WEEKLY_OVERLOAD',
          'Faculty weekly teaching limit exceeded across timetables',
          facultyEntries.map((e) => e.id)
        );
      if (
        [...daily.values()].some((list) => hours(list) > facultyEntries[0].faculty.maxHoursPerDay)
      )
        add(
          'FACULTY_DAILY_OVERLOAD',
          'Faculty daily teaching limit exceeded across timetables',
          facultyEntries.map((e) => e.id)
        );
    }

    // Validate whole multi-period sessions, including sessions edited one row at a time.
    const blocks = new Map<string, typeof entries>();
    for (const e of entries) {
      if (!['LAB', 'PRACTICAL'].includes(e.courseOffering.subject.type)) continue;
      const key =
        e.sessionId ||
        e.timetableId +
          '|' +
          e.courseOfferingId +
          '|' +
          (e.practicalBatchId || '') +
          '|' +
          e.day.name;
      const block = blocks.get(key) ?? [];
      block.push(e);
      blocks.set(key, block);
    }
    for (const block of blocks.values()) {
      if (!block.some((e) => targetIds.has(e.id))) continue;
      const subject = block[0].courseOffering.subject;
      const expected =
        subject.type === 'LAB'
          ? Math.max(2, subject.labHours || 2)
          : subject.weeklyHours === 1
            ? 1
            : 2;
      block.sort((a, b) => minutes(a.timeSlot.startTime) - minutes(b.timeSlot.startTime));
      if (
        block.length !== expected ||
        block.some(
          (e, i) =>
            e.facultyId !== block[0].facultyId ||
            e.roomId !== block[0].roomId ||
            e.laboratoryId !== block[0].laboratoryId ||
            (i > 0 && minutes(block[i - 1].timeSlot.endTime) !== minutes(e.timeSlot.startTime))
        )
      ) {
        add(
          'INCOMPLETE_SESSION',
          'Multi-period session must have consecutive periods with the same faculty and venue',
          block.map((e) => e.id)
        );
      }
    }
    return conflicts;
  }

  async detectAndPersist(timetableId: string) {
    const conflicts = await this.detect(timetableId);
    await this.db.timetableConflict.deleteMany({ where: { timetableId, resolved: false } });
    if (conflicts.length)
      await this.db.timetableConflict.createMany({
        data: conflicts.map((c) => ({ timetableId, ...c })),
      });
    return conflicts;
  }
}
export const conflictService = new ConflictService();
