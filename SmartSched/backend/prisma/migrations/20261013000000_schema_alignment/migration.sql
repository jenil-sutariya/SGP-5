-- DropForeignKey
ALTER TABLE "lab_assignments" DROP CONSTRAINT "lab_assignments_courseOfferingId_fkey";

-- DropForeignKey
ALTER TABLE "lab_assignments" DROP CONSTRAINT "lab_assignments_laboratoryId_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_programId_fkey";

-- DropForeignKey
ALTER TABLE "time_slots" DROP CONSTRAINT "time_slots_dayId_fkey";

-- DropIndex
DROP INDEX "time_slots_dayId_idx";

-- DropIndex
DROP INDEX "time_slots_order_dayId_key";

-- DropIndex
DROP INDEX "timetable_entries_timetableId_dayId_timeSlotId_laboratoryId_key";

-- DropIndex
DROP INDEX "timetable_entries_timetableId_dayId_timeSlotId_sectionId_key";

-- AlterTable
ALTER TABLE "days" ADD COLUMN     "instituteId" TEXT;

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "instituteId" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "practicalBatchId" TEXT,
ALTER COLUMN "programId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "time_slots" ADD COLUMN     "instituteId" TEXT;

-- AlterTable
ALTER TABLE "timetable_entries" ADD COLUMN     "practicalBatchId" TEXT;

-- AlterTable
ALTER TABLE "user_settings" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';

-- DropTable
DROP TABLE "lab_assignments";

-- CreateTable
CREATE TABLE "practical_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practical_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practical_batches_sectionId_code_key" ON "practical_batches"("sectionId", "code");

-- CreateIndex
CREATE INDEX "days_instituteId_idx" ON "days"("instituteId");

-- CreateIndex
CREATE INDEX "holidays_instituteId_idx" ON "holidays"("instituteId");

-- CreateIndex
CREATE INDEX "students_programId_idx" ON "students"("programId");

-- CreateIndex
CREATE INDEX "students_practicalBatchId_idx" ON "students"("practicalBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_order_key" ON "time_slots"("order");

-- CreateIndex
CREATE INDEX "time_slots_instituteId_idx" ON "time_slots"("instituteId");

-- CreateIndex
CREATE INDEX "timetable_entries_practicalBatchId_idx" ON "timetable_entries"("practicalBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_entries_timetableId_dayId_timeSlotId_practicalBat_key" ON "timetable_entries"("timetableId", "dayId", "timeSlotId", "practicalBatchId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_practicalBatchId_fkey" FOREIGN KEY ("practicalBatchId") REFERENCES "practical_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "days" ADD CONSTRAINT "days_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practical_batches" ADD CONSTRAINT "practical_batches_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_practicalBatchId_fkey" FOREIGN KEY ("practicalBatchId") REFERENCES "practical_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

