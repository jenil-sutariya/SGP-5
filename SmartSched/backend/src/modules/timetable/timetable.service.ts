import { TimetableStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import prisma from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../utils/AppError';
import { getPagination, PaginationQuery } from '../../utils/pagination';
import { conflictService } from './conflict.service';

const entryInclude = {
  courseOffering: { include: { subject: true, course: true } },
  faculty: { include: { user: true } },
  room: true,
  laboratory: true,
  day: true,
  timeSlot: true,
  section: true,
  practicalBatch: true,
} as const;

export class TimetableService {
  async list(query: PaginationQuery & { semesterId?: string; departmentId?: string; status?: string; instituteId?: string }) {
    const { page, limit, skip, sortBy, sortOrder } = getPagination(query);
    const where = {
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status as TimetableStatus } : {}),
      ...(query.instituteId ? { department: { instituteId: query.instituteId } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.timetable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          academicYear: true,
          semester: true,
          department: true,
          _count: { select: { entries: true, conflicts: true } },
        },
      }),
      prisma.timetable.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getById(id: string) {
    const tt = await prisma.timetable.findUnique({
      where: { id },
      include: {
        academicYear: true,
        semester: true,
        department: true,
        entries: { include: entryInclude },
        conflicts: true,
      },
    });
    if (!tt) throw new NotFoundError('Timetable');
    return tt;
  }

  async create(data: { name: string; academicYearId: string; semesterId: string; departmentId?: string | null; createdById?: string }) {
    return prisma.timetable.create({
      data: { ...data, status: TimetableStatus.DRAFT },
    });
  }

  async update(id: string, data: Partial<{ name: string; status: TimetableStatus }>) {
    await this.getById(id);
    return prisma.timetable.update({ where: { id }, data });
  }

  async publish(id: string) {
    const conflicts = await conflictService.detect(id);
    const critical = conflicts.filter((c) => c.severity === 'CRITICAL');
    if (critical.length) {
      throw new ConflictError('Cannot publish timetable with critical conflicts', critical);
    }
    return prisma.timetable.update({
      where: { id },
      data: { status: TimetableStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    await prisma.timetable.delete({ where: { id } });
    return { message: 'Timetable deleted' };
  }

  async getEntries(timetableId: string) {
    await this.getById(timetableId);
    return prisma.timetableEntry.findMany({
      where: { timetableId },
      include: entryInclude,
      orderBy: [{ day: { order: 'asc' } }, { timeSlot: { order: 'asc' } }],
    });
  }

  async addEntry(timetableId: string, data: {
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
  }) {
    await this.getById(timetableId);
    const entry = await prisma.timetableEntry.create({
      data: { timetableId, ...data },
      include: entryInclude,
    });
    await conflictService.detectAndPersist(timetableId);
    return entry;
  }

  async updateEntry(entryId: string, data: Partial<{
    dayId: string;
    timeSlotId: string;
    roomId: string | null;
    laboratoryId: string | null;
    facultyId: string;
    isLocked: boolean;
    notes: string;
  }>) {
    const entry = await prisma.timetableEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError('Timetable entry');
    if (entry.isLocked && (data.dayId || data.timeSlotId || data.roomId || data.facultyId)) {
      throw new ConflictError('Entry is locked');
    }
    const updated = await prisma.timetableEntry.update({
      where: { id: entryId },
      data,
      include: entryInclude,
    });
    await conflictService.detectAndPersist(entry.timetableId);
    return updated;
  }

  async deleteEntry(entryId: string) {
    const entry = await prisma.timetableEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError('Timetable entry');
    if (entry.isLocked) throw new ConflictError('Entry is locked');
    await prisma.timetableEntry.delete({ where: { id: entryId } });
    await conflictService.detectAndPersist(entry.timetableId);
    return { message: 'Entry deleted' };
  }

  async viewByFaculty(facultyId: string, semesterId?: string) {
    return prisma.timetableEntry.findMany({
      where: {
        facultyId,
        timetable: {
          status: { in: [TimetableStatus.PUBLISHED, TimetableStatus.GENERATED] },
          ...(semesterId ? { semesterId } : {}),
        },
      },
      include: entryInclude,
      orderBy: [{ day: { order: 'asc' } }, { timeSlot: { order: 'asc' } }],
    });
  }

  async viewBySection(sectionId: string, semesterId?: string) {
    return prisma.timetableEntry.findMany({
      where: {
        sectionId,
        timetable: {
          status: { in: [TimetableStatus.PUBLISHED, TimetableStatus.GENERATED] },
          ...(semesterId ? { semesterId } : {}),
        },
      },
      include: entryInclude,
      orderBy: [{ day: { order: 'asc' } }, { timeSlot: { order: 'asc' } }],
    });
  }

  async viewByRoom(roomId: string, semesterId?: string) {
    return prisma.timetableEntry.findMany({
      where: {
        roomId,
        timetable: {
          status: { in: [TimetableStatus.PUBLISHED, TimetableStatus.GENERATED] },
          ...(semesterId ? { semesterId } : {}),
        },
      },
      include: entryInclude,
      orderBy: [{ day: { order: 'asc' } }, { timeSlot: { order: 'asc' } }],
    });
  }

  async viewByDepartment(departmentId: string, semesterId?: string) {
    return prisma.timetableEntry.findMany({
      where: {
        timetable: {
          departmentId,
          status: { in: [TimetableStatus.PUBLISHED, TimetableStatus.GENERATED] },
          ...(semesterId ? { semesterId } : {}),
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
