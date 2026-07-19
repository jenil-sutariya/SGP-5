-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'INSTITUTE_ADMIN';

-- CreateTable
CREATE TABLE IF NOT EXISTS "institutes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT,
    "description" TEXT,
    "adminUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "institutes_code_key" ON "institutes"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "institutes_adminUserId_key" ON "institutes"("adminUserId");

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "instituteId" TEXT;
CREATE INDEX IF NOT EXISTS "users_instituteId_idx" ON "users"("instituteId");

-- AlterTable buildings
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "instituteId" TEXT;
CREATE INDEX IF NOT EXISTS "buildings_instituteId_idx" ON "buildings"("instituteId");

-- AlterTable departments: drop global unique on code, add instituteId
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "instituteId" TEXT;

-- Backfill placeholder institute if departments exist without institute
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "departments" WHERE "instituteId" IS NULL) THEN
    INSERT INTO "institutes" ("id", "code", "name", "fullName", "updatedAt")
    VALUES ('temp_institute_cspit', 'CSPIT', 'CSPIT', 'Chandubhai S. Patel Institute of Technology', CURRENT_TIMESTAMP)
    ON CONFLICT ("code") DO NOTHING;
    UPDATE "departments" SET "instituteId" = (SELECT "id" FROM "institutes" WHERE "code" = 'CSPIT' LIMIT 1)
    WHERE "instituteId" IS NULL;
  END IF;
END $$;

ALTER TABLE "departments" ALTER COLUMN "instituteId" SET NOT NULL;

DROP INDEX IF EXISTS "departments_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "departments_instituteId_code_key" ON "departments"("instituteId", "code");
CREATE INDEX IF NOT EXISTS "departments_instituteId_idx" ON "departments"("instituteId");

-- Student batches
CREATE TABLE IF NOT EXISTS "student_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "programId" TEXT,
    "batchYear" INTEGER NOT NULL,
    "semesterNo" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_batches_instituteId_code_key" ON "student_batches"("instituteId", "code");
CREATE INDEX IF NOT EXISTS "student_batches_departmentId_idx" ON "student_batches"("departmentId");
CREATE INDEX IF NOT EXISTS "student_batches_batchYear_idx" ON "student_batches"("batchYear");

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "batchId" TEXT;
CREATE INDEX IF NOT EXISTS "students_batchId_idx" ON "students"("batchId");

ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "batchId" TEXT;
CREATE INDEX IF NOT EXISTS "sections_batchId_idx" ON "sections"("batchId");

-- FKs
DO $$ BEGIN
  ALTER TABLE "institutes" ADD CONSTRAINT "institutes_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "buildings" ADD CONSTRAINT "buildings_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "student_batches" ADD CONSTRAINT "student_batches_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "student_batches" ADD CONSTRAINT "student_batches_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "student_batches" ADD CONSTRAINT "student_batches_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "student_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sections" ADD CONSTRAINT "sections_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "student_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
