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
      ...(query.instituteId
        ? {
            OR: [
              { department: { instituteId: query.instituteId } },
              { entries: { some: { section: { department: { instituteId: query.instituteId } } } } },
              { entries: { some: { courseOffering: { course: { department: { instituteId: query.instituteId } } } } } },
            ],
          }
        : {}),
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

  async getById(id: string, instituteId?: string) {
    const tt = await prisma.timetable.findUnique({
      where: { id },
      include: {
        academicYear: true,
        semester: true,
        department: true,
        entries: {
          where: instituteId
            ? {
                OR: [
                  { section: { department: { instituteId } } },
                  { courseOffering: { course: { department: { instituteId } } } },
                  { courseOffering: { subject: { department: { instituteId } } } },
                  { faculty: { department: { instituteId } } },
                ],
              }
            : undefined,
          include: entryInclude,
        },
        conflicts: true,
      },
    });
    if (!tt) throw new NotFoundError('Timetable');

    // Auto-fix legacy entries based strictly on subject.type:
    // - LAB -> Laboratory (laboratoryId)
    // - PRACTICAL -> Classroom (roomId)
    // - THEORY -> Classroom (roomId)
    const invalidEntries = tt.entries.filter((e) => {
      const s = e.courseOffering?.subject;
      if (!s) return false;
      if (s.type === 'LAB' && (!e.laboratoryId || !e.practicalBatchId)) return true;
      if (s.type === 'PRACTICAL' && !e.roomId) return true;
      if (s.type === 'THEORY' && !e.roomId) return true;
      return false;
    });

    if (invalidEntries.length > 0) {
      const labs = await prisma.laboratory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
      const rooms = await prisma.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });

      const sectionIds = Array.from(new Set(invalidEntries.map((e) => e.sectionId).filter(Boolean))) as string[];
      const sectionsWithBatches = await prisma.section.findMany({
        where: { id: { in: sectionIds } },
        include: { practicalBatches: { orderBy: { name: 'asc' } } },
      });
      const sectionBatchMap = new Map(sectionsWithBatches.map((sec) => [sec.id, sec.practicalBatches]));

      for (let idx = 0; idx < invalidEntries.length; idx++) {
        const entry = invalidEntries[idx];
        const s = entry.courseOffering?.subject;
        const deptId = s?.departmentId || entry.section?.departmentId;

        if (s?.type === 'LAB') {
          const deptLabs = labs.filter((l) => l.departmentId === deptId);
          const availableLabs = deptLabs.length > 0 ? deptLabs : labs;
          const assignedLab = entry.laboratoryId ? null : availableLabs[idx % availableLabs.length];

          const secBatches = entry.sectionId ? (sectionBatchMap.get(entry.sectionId) ?? []) : [];
          const assignedBatch = entry.practicalBatchId
            ? null
            : secBatches.length > 0
            ? secBatches[idx % secBatches.length]
            : null;

          await prisma.timetableEntry.update({
            where: { id: entry.id },
            data: {
              isLab: true,
              roomId: null,
              ...(assignedLab ? { laboratoryId: assignedLab.id } : {}),
              ...(assignedBatch ? { practicalBatchId: assignedBatch.id } : {}),
            },
          });
        } else {
          // PRACTICAL or THEORY -> Conducted in Classroom (roomId)
          const deptRooms = rooms.filter((r) => r.departmentId === deptId);
          const availableRooms = deptRooms.length > 0 ? deptRooms : rooms;
          const assignedRoom = entry.roomId ? null : availableRooms[idx % availableRooms.length];

          await prisma.timetableEntry.update({
            where: { id: entry.id },
            data: {
              isLab: false,
              laboratoryId: null,
              ...(assignedRoom ? { roomId: assignedRoom.id } : {}),
            },
          });
        }
      }

      return prisma.timetable.findUnique({
        where: { id },
        include: {
          academicYear: true,
          semester: true,
          department: true,
          entries: {
            where: instituteId
              ? {
                  OR: [
                    { section: { department: { instituteId } } },
                    { courseOffering: { course: { department: { instituteId } } } },
                    { courseOffering: { subject: { department: { instituteId } } } },
                    { faculty: { department: { instituteId } } },
                  ],
                }
              : undefined,
            include: entryInclude,
          },
          conflicts: true,
        },
      }) as any;
    }
    // Clean up any overlapping theory entries that conflict with practical batch sessions in the same time slot
    const labSlotKeys = new Set<string>();
    for (const e of tt.entries) {
      if ((e.isLab || e.practicalBatchId) && e.sectionId) {
        labSlotKeys.add(`${e.dayId}|${e.timeSlotId}|${e.sectionId}`);
      }
    }

    const conflictingTheoryIds: string[] = [];
    for (const e of tt.entries) {
      if (!e.isLab && !e.practicalBatchId && e.sectionId) {
        const k = `${e.dayId}|${e.timeSlotId}|${e.sectionId}`;
        if (labSlotKeys.has(k)) {
          conflictingTheoryIds.push(e.id);
        }
      }
    }

    if (conflictingTheoryIds.length > 0) {
      await prisma.timetableEntry.deleteMany({
        where: { id: { in: conflictingTheoryIds } },
      });
      return prisma.timetable.findUnique({
        where: { id },
        include: {
          academicYear: true,
          semester: true,
          department: true,
          entries: {
            where: instituteId
              ? {
                  OR: [
                    { section: { department: { instituteId } } },
                    { courseOffering: { course: { department: { instituteId } } } },
                    { courseOffering: { subject: { department: { instituteId } } } },
                    { faculty: { department: { instituteId } } },
                  ],
                }
              : undefined,
            include: entryInclude,
          },
          conflicts: true,
        },
      }) as any;
    }
    // Enforce 2 continuous hours for every Lab session (ensure paired timeSlotId exists on the same day)
    const timeSlotsList = await prisma.timeSlot.findMany({
      where: { isActive: true, isLunchBreak: false },
      orderBy: { order: 'asc' },
    });

    const slotByOrder = new Map(timeSlotsList.map((s) => [s.order, s.id]));
    const orderBySlot = new Map(timeSlotsList.map((s) => [s.id, s.order]));

    const getPairedSlotId = (slotId: string): string | null => {
      const order = orderBySlot.get(slotId);
      if (!order) return null;
      if (order === 1) return slotByOrder.get(2) ?? null;
      if (order === 2) return slotByOrder.get(1) ?? null;
      if (order === 4) return slotByOrder.get(5) ?? null;
      if (order === 5) return slotByOrder.get(4) ?? null;
      if (order === 7) return slotByOrder.get(8) ?? null;
      if (order === 8) return slotByOrder.get(7) ?? null;
      return null;
    };

    const labEntries = tt.entries.filter((e) => {
      const s = e.courseOffering?.subject;
      return e.isLab || s?.type === 'LAB' || (e.practicalBatchId != null);
    });

    let createdPairs = false;

    for (const entry of labEntries) {
      const pairedSlotId = getPairedSlotId(entry.timeSlotId);
      if (!pairedSlotId) continue;

      const exists = tt.entries.some((e) =>
        e.dayId === entry.dayId &&
        e.timeSlotId === pairedSlotId &&
        e.courseOfferingId === entry.courseOfferingId &&
        (e.practicalBatchId === entry.practicalBatchId || (!e.practicalBatchId && !entry.practicalBatchId))
      );

      if (!exists) {
        await prisma.timetableEntry.deleteMany({
          where: {
            timetableId: id,
            dayId: entry.dayId,
            timeSlotId: pairedSlotId,
            OR: [
              ...(entry.sectionId ? [{ sectionId: entry.sectionId, isLab: false }] : []),
              { facultyId: entry.facultyId, isLab: false },
            ],
          },
        });

        await prisma.timetableEntry.create({
          data: {
            timetableId: id,
            courseOfferingId: entry.courseOfferingId,
            facultyId: entry.facultyId,
            laboratoryId: entry.laboratoryId,
            roomId: entry.roomId,
            sectionId: entry.sectionId,
            practicalBatchId: entry.practicalBatchId,
            dayId: entry.dayId,
            timeSlotId: pairedSlotId,
            isLab: true,
          },
        });
        createdPairs = true;
      }
    }

    if (createdPairs) {
      return prisma.timetable.findUnique({
        where: { id },
        include: {
          academicYear: true,
          semester: true,
          department: true,
          entries: {
            where: instituteId
              ? {
                  OR: [
                    { section: { department: { instituteId } } },
                    { courseOffering: { course: { department: { instituteId } } } },
                    { courseOffering: { subject: { department: { instituteId } } } },
                    { faculty: { department: { instituteId } } },
                  ],
                }
              : undefined,
            include: entryInclude,
          },
          conflicts: true,
        },
      }) as any;
    }

    return tt;
  }

  async create(data: { name: string; academicYearId: string; semesterId: string; departmentId?: string | null; createdById?: string }) {
    return prisma.timetable.create({
      data: { ...data, status: TimetableStatus.DRAFT },
    });
  }

  async update(id: string, data: Partial<{ name: string; status: TimetableStatus }>) {
    await this.getById(id);
    return prisma.timetable.update({
      where: { id },
      data,
    });
  }

  async publish(id: string) {
    await this.getById(id);
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

    // If moving a lab entry to a new day or slot, delete any duplicate lab entries for the same offering & batch from the old day
    if ((entry.isLab || entry.practicalBatchId) && data.dayId && data.dayId !== entry.dayId) {
      await prisma.timetableEntry.deleteMany({
        where: {
          timetableId: entry.timetableId,
          courseOfferingId: entry.courseOfferingId,
          practicalBatchId: entry.practicalBatchId,
          dayId: entry.dayId,
          id: { not: entryId },
        },
      });
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
