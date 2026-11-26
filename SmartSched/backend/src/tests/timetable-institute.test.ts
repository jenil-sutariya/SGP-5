
jest.mock('../database/prisma', () => ({ __esModule: true, default: Object.fromEntries(
  ['timetable', 'courseOffering', 'section', 'faculty', 'room', 'laboratory', 'practicalBatch', 'day', 'timeSlot']
    .map((model) => [model, { findUnique: jest.fn() }])
) }));
import prisma from '../database/prisma';
import { validateEntryInstitute } from '../modules/timetable/timetable.institute';

const entry = { timetableId: 'tt', courseOfferingId: 'offering', facultyId: 'f', sectionId: 's', roomId: 'r', dayId: 'd', timeSlotId: 'p' };
const department = { instituteId: 'depstars' };
beforeEach(() => {
  jest.resetAllMocks();
  (prisma.timetable.findUnique as jest.Mock).mockResolvedValue({ department, metadata: null });
  (prisma.courseOffering.findUnique as jest.Mock).mockResolvedValue({ isActive: true, course: { department }, subject: { department }, sectionId: 's' });
  (prisma.section.findUnique as jest.Mock).mockResolvedValue({ department, batch: { instituteId: 'depstars' } });
  (prisma.faculty.findUnique as jest.Mock).mockResolvedValue({ department, isActive: true });
  (prisma.room.findUnique as jest.Mock).mockResolvedValue({ isActive: true, building: { instituteId: 'depstars' }, department: null });
  (prisma.day.findUnique as jest.Mock).mockResolvedValue({ instituteId: null });
  (prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({ instituteId: null });
});
test('accepts a shared room within the batch institute', async () => {
  await expect(validateEntryInstitute(entry)).resolves.toBeUndefined();
});
test('rejects a shared room in another institute', async () => {
  (prisma.room.findUnique as jest.Mock).mockResolvedValue({ isActive: true, building: { instituteId: 'cspit' }, department: null });
  await expect(validateEntryInstitute(entry)).rejects.toThrow('Classroom building');
});
test('rejects inconsistent laboratory building ownership', async () => {
  (prisma.laboratory.findUnique as jest.Mock).mockResolvedValue({ isActive: true, building: { instituteId: 'cspit' }, department });
  await expect(validateEntryInstitute({ ...entry, roomId: null, laboratoryId: 'lab' })).rejects.toThrow('Laboratory building');
});
test('rejects a student batch from another institute', async () => {
  (prisma.section.findUnique as jest.Mock).mockResolvedValue({ department, batch: { instituteId: 'cspit' } });
  await expect(validateEntryInstitute(entry)).rejects.toThrow('Student batch');
});
test('rejects a faculty member from another institute', async () => {
  (prisma.faculty.findUnique as jest.Mock).mockResolvedValue({ department: { instituteId: 'cspit' }, isActive: true });
  await expect(validateEntryInstitute(entry)).rejects.toThrow('Faculty');
});
test('respects institute ownership on a timetable without a department', async () => {
  (prisma.timetable.findUnique as jest.Mock).mockResolvedValue({ department: null, metadata: { instituteId: 'cspit' } });
  await expect(validateEntryInstitute(entry)).rejects.toThrow('Timetable');
});
test('rejects a period owned by another institute', async () => {
  (prisma.timeSlot.findUnique as jest.Mock).mockResolvedValue({ instituteId: 'cspit' });
  await expect(validateEntryInstitute(entry)).rejects.toThrow('Time slot');
});
