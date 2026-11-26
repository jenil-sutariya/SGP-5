import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
dotenv.config({ path: '.env.development' });
dotenv.config();
const db = new PrismaClient();
async function main() {
  const timetables = await db.$queryRaw<
    any[]
  >`SELECT t.id,t.name,t.status,i.code institute,d.code department,s.name semester,s."startDate",s."endDate",count(e.id)::integer entries FROM timetables t LEFT JOIN departments d ON d.id=t."departmentId" LEFT JOIN institutes i ON i.id=coalesce(d."instituteId",t.metadata->>'instituteId') JOIN semesters s ON s.id=t."semesterId" LEFT JOIN timetable_entries e ON e."timetableId"=t.id GROUP BY t.id,i.code,d.code,s.name,s."startDate",s."endDate" ORDER BY t."createdAt"`;
  const clashes = await db.$queryRaw<
    any[]
  >`SELECT a.id AS "entryA",b.id AS "entryB",ta.id AS "timetableA",tb.id AS "timetableB",d.name AS day,x."startTime" AS start,x."endTime" AS finish,
    concat_ws(', ',CASE WHEN a."facultyId"=b."facultyId" THEN 'faculty' END,CASE WHEN a."roomId"=b."roomId" THEN 'classroom' END,CASE WHEN a."laboratoryId"=b."laboratoryId" THEN 'laboratory' END,CASE WHEN a."sectionId"=b."sectionId" AND (a."practicalBatchId" IS NULL OR b."practicalBatchId" IS NULL OR a."practicalBatchId"=b."practicalBatchId") THEN 'student group' END) AS reasons,
    coalesce(r.code,l.code) venue
    FROM timetable_entries a JOIN timetable_entries b ON a.id<b.id JOIN days d ON d.id=a."dayId" JOIN days bd ON bd.id=b."dayId" AND bd.name=d.name
    JOIN time_slots x ON x.id=a."timeSlotId" JOIN time_slots y ON y.id=b."timeSlotId"
    JOIN timetables ta ON ta.id=a."timetableId" JOIN timetables tb ON tb.id=b."timetableId"
    JOIN semesters sa ON sa.id=ta."semesterId" JOIN semesters sb ON sb.id=tb."semesterId"
    LEFT JOIN rooms r ON r.id=a."roomId" LEFT JOIN laboratories l ON l.id=a."laboratoryId"
    WHERE ta.status IN ('GENERATED','PUBLISHED') AND tb.status IN ('GENERATED','PUBLISHED')
    AND sa."startDate"<=sb."endDate" AND sb."startDate"<=sa."endDate"
    AND x."startTime"<y."endTime" AND y."startTime"<x."endTime"
    AND (a."facultyId"=b."facultyId" OR a."roomId"=b."roomId" OR a."laboratoryId"=b."laboratoryId" OR (a."sectionId"=b."sectionId" AND (a."practicalBatchId" IS NULL OR b."practicalBatchId" IS NULL OR a."practicalBatchId"=b."practicalBatchId"))) ORDER BY ta.id,d.name,x."startTime",a.id`;
  const table = (headers: string[], rows: unknown[][]) =>
    '| ' +
    headers.join(' | ') +
    ' |\n| ' +
    headers.map(() => '---').join(' | ') +
    ' |\n' +
    rows
      .map(
        (row) =>
          '| ' +
          row.map((v) => String(v ?? 'Institute-wide').replaceAll('|', '/')).join(' | ') +
          ' |'
      )
      .join('\n');
  const report = `# Current timetable database audit

Read-only snapshot taken ${new Date().toISOString()}. No working-database records were changed by this audit. The original migration preflight and its approved resolution remain in [TIMETABLE-LEGACY-PREFLIGHT.md](TIMETABLE-LEGACY-PREFLIGHT.md).

${timetables.length} timetables; ${timetables.reduce((n, t) => n + t.entries, 0)} saved periods; ${clashes.length} overlapping weekly entry pairs across overlapping semester dates. These are entry pairs, not a count of affected students or distinct calendar dates.

${table(
  ['ID', 'Institute', 'Department', 'Semester', 'Status', 'Periods'],
  timetables.map((t) => [t.id, t.institute, t.department, t.semester, t.status, t.entries])
)}

## Active timetable review

${clashes.length === 0 ? 'No overlapping active weekly entry pairs were detected.' : 'Review the active entry pairs below against actual teaching dates before changing saved teaching.'} Archived and draft timetables are excluded from active conflict checks; their saved periods remain included in the table above. This audit does not archive, delete or regenerate teaching.

## Conflicting entry pairs

${table(
  ['Timetable', 'Entry A', 'Entry B', 'Day', 'Time', 'Venue', 'Conflict'],
  clashes.map((c) => [
    c.timetableA,
    c.entryA,
    c.entryB,
    c.day,
    c.start + '–' + c.finish,
    c.venue,
    c.reasons,
  ])
)}

The SQL pair audit is conservative about dated holidays/leave. Database reservations and exclusion constraints enforce conflicts on actual teaching dates.
`;
  writeFileSync('../docs/TIMETABLE-DATABASE-AUDIT.md', report);
  console.log(
    JSON.stringify({
      timetables: timetables.length,
      periods: timetables.reduce((n, t) => n + t.entries, 0),
      pairs: clashes.length,
      report: 'docs/TIMETABLE-DATABASE-AUDIT.md',
    })
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
