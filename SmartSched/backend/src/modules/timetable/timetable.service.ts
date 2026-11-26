import { randomUUID } from 'node:crypto';
import { dateKey, datedWeekOccurrences } from './occurrence.rules';
import { TimetableStatus, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import prisma from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../utils/AppError';
import { getPagination, PaginationQuery } from '../../utils/pagination';
import { ConflictService } from './conflict.service';
import { withScheduleWrite } from '../scheduler/scheduler.bookings';
import { assertTeachingComplete } from './timetable.completeness';
import { validateEntryInstitute } from './timetable.institute';
import { TimetableAccess, facultyNameSelect } from './timetable.access';
import { ValidationError } from '../../utils/AppError';

const entryInclude = {
  courseOffering: { include: { subject: true, course: true } },
  faculty: { include: { user: { select: facultyNameSelect } } },
  room: true,
  laboratory: true,
  day: true,
  timeSlot: true,
  section: true,
  practicalBatch: true,
} as const;

export class TimetableService {
  constructor(
    private db: Prisma.TransactionClient = prisma,
    private access?: TimetableAccess
  ) {}

  private async assertNoConflicts(id: string) {
    const conflicts = await new ConflictService(this.db).detectAndPersist(id);
    if (conflicts.length)
      throw new ConflictError(
        'This change conflicts with scheduled teaching. No changes were saved.',
        conflicts
      );
  }

  private async assertEditable(id: string) {
    if (this.access) await this.access.assertTimetable(id, true, this.db);
    const timetable = await this.getById(id);
    if (timetable.status === TimetableStatus.PUBLISHED)
      throw new ConflictError('Unpublish the timetable before editing entries');
    if (timetable.status === TimetableStatus.ARCHIVED)
      throw new ConflictError('Archived timetables cannot be edited');
    return timetable;
  }

  async list(
    query: PaginationQuery & {
      semesterId?: string;
      departmentId?: string;
      status?: string;
      instituteId?: string;
    }
  ) {
    const { page, limit, skip, sortBy, sortOrder } = getPagination(query);
    const where: Prisma.TimetableWhereInput = {
      AND: [this.access?.timetableWhere || {}],
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status as TimetableStatus } : {}),
      ...(query.instituteId ? { instituteId: query.instituteId } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.timetable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          academicYear: true,
          semester: true,
          department: true,
          _count: {
            select: {
              entries: { where: this.access?.entryWhere },
              conflicts: !this.access?.restricted,
            },
          },
        },
      }),
      this.db.timetable.count({ where }),
    ]);
    return {
      data: this.access?.restricted ? data.map((tt) => ({ ...tt, metadata: null })) : data,
      total,
      page,
      limit,
    };
  }

  async getById(id: string, instituteId?: string) {
    if (this.access) await this.access.assertTimetable(id, false, this.db);
    const tt = await this.db.timetable.findFirst({
      where: {
        id,
        AND: [this.access?.timetableWhere || {}],
        ...(instituteId ? { instituteId } : {}),
      },
      include: {
        academicYear: true,
        semester: true,
        department: true,
        entries: { where: this.access?.entryWhere, include: entryInclude },
        conflicts: !this.access?.restricted,
      },
    });
    if (!tt) throw new NotFoundError('Timetable');
    if (this.access?.restricted) return { ...tt, metadata: null, conflicts: [] };
    return tt;
  }

  async create(data: {
    name: string;
    academicYearId: string;
    semesterId: string;
    departmentId?: string | null;
    createdById?: string;
    instituteId: string;
  }) {
    this.access?.assertManager();
    const semester = await this.db.semester.findUnique({ where: { id: data.semesterId } });
    if (!semester || semester.academicYearId !== data.academicYearId)
      throw new ValidationError('Semester must belong to the academic year');
    return this.db.timetable.create({
      data: { ...data, status: TimetableStatus.DRAFT },
    });
  }

  private instituteScope() {
    return this.access?.user.instituteId ?? undefined;
  }

  async update(...args: Parameters<TimetableService['updateWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).updateWithin(...args),
      this.instituteScope()
    );
  }

  private async updateWithin(id: string, data: Partial<{ name: string; status: TimetableStatus }>) {
    if (this.access) await this.access.assertTimetable(id, true, this.db);
    if (data.status === TimetableStatus.PUBLISHED) {
      await this.publishWithin(id);
    }
    await this.getById(id);
    const updated = await this.db.timetable.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status,
        ...(data.status && data.status !== TimetableStatus.PUBLISHED ? { publishedAt: null } : {}),
      },
    });
    if (data.status === TimetableStatus.GENERATED) {
      const timetable = await this.getById(id);
      for (const entry of timetable.entries) await validateEntryInstitute(entry, this.db);
      await this.assertNoConflicts(id);
    }
    return updated;
  }

  async publish(...args: Parameters<TimetableService['publishWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).publishWithin(...args),
      this.instituteScope()
    );
  }

  private async publishWithin(id: string) {
    if (this.access) await this.access.assertTimetable(id, true, this.db);
    const timetable = await this.getById(id);
    if (timetable.status !== TimetableStatus.GENERATED)
      throw new ConflictError('Only a generated timetable can be published');
    if (!timetable.entries.length) {
      throw new ConflictError('Schedule all missing sessions before publishing');
    }
    const fullScope = await this.db.timetable.findUniqueOrThrow({ where: { id } });
    await assertTeachingComplete(this.db, fullScope);
    await this.assertNoConflicts(id);
    for (const entry of timetable.entries) {
      await validateEntryInstitute(entry, this.db);
    }
    return this.db.timetable.update({
      where: { id },
      data: { status: TimetableStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  async unpublish(...args: Parameters<TimetableService['unpublishWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).unpublishWithin(...args),
      this.instituteScope()
    );
  }

  private async unpublishWithin(id: string) {
    if (this.access) await this.access.assertTimetable(id, true, this.db);
    await this.getById(id);
    const result = await this.db.timetable.updateMany({
      where: { id, status: TimetableStatus.PUBLISHED },
      data: { status: TimetableStatus.GENERATED, publishedAt: null },
    });
    if (result.count === 0) {
      throw new ConflictError('Only a published timetable can be unpublished');
    }
    return this.getById(id);
  }

  async remove(...args: Parameters<TimetableService['removeWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).removeWithin(...args),
      this.instituteScope()
    );
  }

  private async removeWithin(id: string) {
    if (this.access) await this.access.assertTimetable(id, true, this.db);
    await this.getById(id);
    await this.db.timetable.delete({ where: { id } });
    return { message: 'Timetable deleted' };
  }

  async getEntries(timetableId: string) {
    await this.getById(timetableId);
    return this.db.timetableEntry.findMany({
      where: {
        timetableId,
        timetable: this.access?.timetableWhere,
        AND: [this.access?.entryWhere || {}],
      },
      include: entryInclude,
      orderBy: [{ day: { order: 'asc' } }, { timeSlot: { order: 'asc' } }],
    });
  }

  async addEntry(...args: Parameters<TimetableService['addEntryWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).addEntryWithin(...args),
      this.instituteScope()
    );
  }

  private async addEntryWithin(
    timetableId: string,
    data: {
      courseOfferingId: string;
      facultyId: string;
      roomId?: string | null;
      laboratoryId?: string | null;
      sectionId?: string | null;
      dayId: string;
      timeSlotId: string;
      isLab?: boolean;
      isLocked?: boolean;
      notes?: string;
    }
  ) {
    await this.assertEditable(timetableId);
    const offering = await this.db.courseOffering.findUniqueOrThrow({
      where: { id: data.courseOfferingId },
      include: { subject: true },
    });
    if (this.sessionLength(offering.subject) > 1)
      throw new ConflictError('Use the whole-session endpoint for multi-period teaching');
    await validateEntryInstitute({ timetableId, ...data }, this.db);
    const entry = await this.db.timetableEntry.create({
      data: { timetableId, ...data },
      include: entryInclude,
    });
    await this.assertNoConflicts(timetableId);
    return entry;
  }

  async updateEntry(...args: Parameters<TimetableService['updateEntryWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).updateEntryWithin(...args),
      this.instituteScope()
    );
  }

  private async updateEntryWithin(
    entryId: string,
    data: Partial<{
      dayId: string;
      timeSlotId: string;
      roomId: string | null;
      laboratoryId: string | null;
      facultyId: string;
      isLocked: boolean;
      notes: string;
    }>
  ) {
    if (this.access) await this.access.assertEntry(entryId, true, this.db);
    const entry = await this.db.timetableEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError('Timetable entry');
    if (
      entry.sessionId &&
      (await this.db.timetableEntry.count({
        where: { timetableId: entry.timetableId, sessionId: entry.sessionId },
      })) > 1
    )
      throw new ConflictError('Use the whole-session editor for multi-period teaching');
    await this.assertEditable(entry.timetableId);
    if (
      entry.isLocked &&
      [
        'dayId',
        'timeSlotId',
        'roomId',
        'laboratoryId',
        'facultyId',
        'sectionId',
        'courseOfferingId',
      ].some((key) => key in data)
    ) {
      throw new ConflictError('Entry is locked');
    }

    await validateEntryInstitute({ ...entry, ...data }, this.db);

    const updated = await this.db.timetableEntry.update({
      where: { id: entryId },
      data,
      include: entryInclude,
    });
    await this.assertNoConflicts(entry.timetableId);
    return updated;
  }

  async deleteEntry(...args: Parameters<TimetableService['deleteEntryWithin']>) {
    return withScheduleWrite(
      (db) => new TimetableService(db, this.access).deleteEntryWithin(...args),
      this.instituteScope()
    );
  }

  private async deleteEntryWithin(entryId: string) {
    if (this.access) await this.access.assertEntry(entryId, true, this.db);
    const entry = await this.db.timetableEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError('Timetable entry');
    if (
      entry.sessionId &&
      (await this.db.timetableEntry.count({
        where: { timetableId: entry.timetableId, sessionId: entry.sessionId },
      })) > 1
    )
      throw new ConflictError('Use the whole-session editor for multi-period teaching');
    await this.assertEditable(entry.timetableId);
    if (entry.isLocked) throw new ConflictError('Entry is locked');
    await this.db.timetableEntry.delete({ where: { id: entryId } });
    await this.assertNoConflicts(entry.timetableId);
    return { message: 'Entry deleted' };
  }

  private sessionLength(subject: { type: string; labHours: number; weeklyHours: number }) {
    if (subject.type === 'LAB') return Math.max(2, subject.labHours || 2);
    if (subject.type === 'PRACTICAL') return subject.weeklyHours === 1 ? 1 : 2;
    return 1;
  }

  private async sessionSlots(startId: string, length: number, instituteId: string) {
    const slots = await this.db.timeSlot.findMany({
      where: { isActive: true, OR: [{ instituteId: null }, { instituteId }] },
      orderBy: { startTime: 'asc' },
    });
    const index = slots.findIndex((slot) => slot.id === startId);
    const selected = index < 0 ? [] : slots.slice(index, index + length);
    if (
      selected.length !== length ||
      selected.some(
        (slot, i) => slot.isLunchBreak || (i > 0 && slots[index + i - 1].endTime !== slot.startTime)
      )
    )
      throw new ConflictError('Choose consecutive teaching periods without a break');
    return selected;
  }

  async createSession(
    timetableId: string,
    data: {
      courseOfferingId: string;
      facultyId: string;
      sectionId: string;
      practicalBatchId?: string | null;
      dayId: string;
      startTimeSlotId: string;
      roomId?: string | null;
      laboratoryId?: string | null;
      notes?: string;
    }
  ) {
    return withScheduleWrite(async (db) => {
      const service = new TimetableService(db, this.access);
      const timetable = await service.assertEditable(timetableId);
      const offering = await db.courseOffering.findUniqueOrThrow({
        where: { id: data.courseOfferingId },
        include: { subject: true },
      });
      const slots = await service.sessionSlots(
        data.startTimeSlotId,
        service.sessionLength(offering.subject),
        timetable.instituteId
      );
      const { startTimeSlotId, ...fields } = data;
      const sessionId = randomUUID();
      for (const slot of slots) {
        const entry = {
          ...fields,
          timetableId,
          sessionId,
          timeSlotId: slot.id,
          isLab: offering.subject.type === 'LAB',
        };
        await validateEntryInstitute(entry, db);
        await db.timetableEntry.create({ data: entry });
      }
      await service.assertNoConflicts(timetableId);
      return db.timetableEntry.findMany({
        where: { timetableId, sessionId },
        include: entryInclude,
      });
    }, this.instituteScope());
  }

  async updateSession(
    timetableId: string,
    sessionId: string,
    data: {
      dayId?: string;
      startTimeSlotId?: string;
      facultyId?: string;
      roomId?: string | null;
      laboratoryId?: string | null;
      isLocked?: boolean;
      notes?: string;
    }
  ) {
    return withScheduleWrite(async (db) => {
      const service = new TimetableService(db, this.access);
      const timetable = await service.assertEditable(timetableId);
      const entries = await db.timetableEntry.findMany({
        where: { timetableId, sessionId },
        include: entryInclude,
        orderBy: { timeSlot: { startTime: 'asc' } },
      });
      if (!entries.length) throw new NotFoundError('Teaching session');
      if (
        entries.some((e) => e.isLocked) &&
        Object.keys(data).some((key) => key !== 'isLocked' && key !== 'notes')
      )
        throw new ConflictError('Unlock the whole session before moving it');
      if (entries.length !== service.sessionLength(entries[0].courseOffering.subject))
        throw new ConflictError('The saved session is incomplete and needs repair');
      const slots = await service.sessionSlots(
        data.startTimeSlotId || entries[0].timeSlotId,
        entries.length,
        timetable.instituteId
      );
      const { startTimeSlotId, ...fields } = data;
      for (let i = 0; i < entries.length; i++) {
        await validateEntryInstitute({ ...entries[i], ...fields, timeSlotId: slots[i].id }, db);
        await db.timetableEntry.update({
          where: { id: entries[i].id },
          data: { ...fields, timeSlotId: slots[i].id },
        });
      }
      await service.assertNoConflicts(timetableId);
      return db.timetableEntry.findMany({
        where: { timetableId, sessionId },
        include: entryInclude,
      });
    }, this.instituteScope());
  }

  async deleteSession(timetableId: string, sessionId: string) {
    return withScheduleWrite(async (db) => {
      const service = new TimetableService(db, this.access);
      await service.assertEditable(timetableId);
      const entries = await db.timetableEntry.findMany({ where: { timetableId, sessionId } });
      if (!entries.length) throw new NotFoundError('Teaching session');
      if (entries.some((e) => e.isLocked))
        throw new ConflictError('Unlock the whole session before deleting it');
      await db.timetableEntry.deleteMany({ where: { timetableId, sessionId } });
      await new ConflictService(db).detectAndPersist(timetableId);
      return { message: 'Whole teaching session deleted', deletedPeriods: entries.length };
    }, this.instituteScope());
  }

  async occurrences(id: string, requestedWeek?: string) {
    const timetable = await this.getById(id);
    const { week, entries } = await datedWeekOccurrences(
      this.db,
      timetable.instituteId,
      timetable.semester,
      timetable.entries,
      requestedWeek,
      () => timetable
    );
    return {
      week,
      semesterStart: dateKey(timetable.semester.startDate),
      semesterEnd: dateKey(timetable.semester.endDate),
      entries,
    };
  }

  async view(kind: 'faculty' | 'section' | 'room' | 'department', id: string, semesterId?: string) {
    if (this.access) await this.access.assertResource(kind, id, this.db);
    const resourceWhere: Prisma.TimetableEntryWhereInput =
      kind === 'department' ? { section: { departmentId: id } } : { [kind + 'Id']: id };
    return this.db.timetableEntry.findMany({
      where: {
        AND: [resourceWhere, this.access?.entryWhere || {}],
        timetable: {
          AND: [
            this.access?.timetableWhere || {},
            { status: { in: ['PUBLISHED', 'GENERATED'] }, ...(semesterId ? { semesterId } : {}) },
          ],
        },
      },
      include: entryInclude,
      orderBy: [{ day: { order: 'asc' } }, { timeSlot: { order: 'asc' } }],
    });
  }

  async exportExcel(timetableId: string): Promise<Buffer> {
    const tt = await this.getById(timetableId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Timetable');
    sheet.columns = [
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Time', key: 'time', width: 18 },
      { header: 'Subject', key: 'subject', width: 30 },
      { header: 'Faculty', key: 'faculty', width: 24 },
      { header: 'Room/Lab', key: 'room', width: 14 },
      { header: 'Section', key: 'section', width: 12 },
      { header: 'Type', key: 'type', width: 10 },
    ];
    for (const e of tt.entries) {
      sheet.addRow({
        day: e.day.name,
        time: `${e.timeSlot.startTime}-${e.timeSlot.endTime}`,
        subject: e.courseOffering.subject.name,
        faculty: `${e.faculty.user.firstName} ${e.faculty.user.lastName}`,
        room: e.room?.code ?? e.laboratory?.code ?? '',
        section: e.section?.code ?? '',
        type: e.isLab ? 'LAB' : 'THEORY',
      });
    }
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportPdf(timetableId: string): Promise<Buffer> {
    const tt = await this.getById(timetableId);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(tt.name, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);

      for (const e of tt.entries) {
        doc.text(
          `${e.day.name} | ${e.timeSlot.startTime}-${e.timeSlot.endTime} | ${e.courseOffering.subject.code} | ${e.faculty.user.firstName} ${e.faculty.user.lastName} | ${e.room?.code ?? e.laboratory?.code ?? '-'} | ${e.section?.code ?? '-'}`
        );
      }
      doc.end();
    });
  }
}

export const timetableService = new TimetableService();
