import { PrismaClient } from '@prisma/client';
import { SchedulerService } from './modules/scheduler/scheduler.service';

const prisma = new PrismaClient();
const schedulerService = new SchedulerService();

async function main() {
  try {
    console.log('🔍 Starting timetable generation verification...');
    
    // Find active Academic Year and Semester
    const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const semester = await prisma.semester.findFirst({ where: { isCurrent: true } });
    
    if (!academicYear || !semester) {
      throw new Error('Active Academic Year or Semester not found!');
    }
    
    console.log(`Academic Year: ${academicYear.name} (ID: ${academicYear.id})`);
    console.log(`Semester: ${semester.name} (ID: ${semester.id})`);
    
    // Generate for all departments at once
    console.log('Generating timetable for all departments and divisions...');
    const result = await schedulerService.generate({
      academicYearId: academicYear.id,
      semesterId: semester.id,
      departmentId: null, // all departments
      name: 'Full University Timetable',
      useGenetic: true,
    });
    
    console.log('✅ Timetable generated successfully!');
    console.log(`Timetable ID: ${result.id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Score: ${result.score}`);
    
    const metadata = result.metadata as any;
    console.log(`Assigned Sessions: ${metadata?.assignedSessions}`);
    console.log(`Unassigned Sessions count: ${metadata?.unassignedSessions}`);
    if (metadata?.unassigned?.length > 0) {
      console.log('Unassigned detail:', metadata.unassigned);
    }
    
    // Query entries group by section
    const entries = await prisma.timetableEntry.findMany({
      where: { timetableId: result.id },
      include: {
        section: true,
        courseOffering: { include: { subject: true } },
      },
    });
    
    const sectionSummary: Record<string, { lectures: number; labs: number; subjects: Set<string> }> = {};
    for (const e of entries) {
      const sectionName = e.section?.name || 'Unknown';
      if (!sectionSummary[sectionName]) {
        sectionSummary[sectionName] = { lectures: 0, labs: 0, subjects: new Set() };
      }
      if (e.isLab) {
        sectionSummary[sectionName].labs += 1;
      } else {
        sectionSummary[sectionName].lectures += 1;
      }
      sectionSummary[sectionName].subjects.add(e.courseOffering.subject.name);
    }
    
    console.log('\n=== Timetable Summary per Division ===');
    for (const [sectionName, summary] of Object.entries(sectionSummary)) {
      console.log(`Section: ${sectionName}`);
      console.log(` - Theory periods scheduled: ${summary.lectures}`);
      console.log(` - Lab periods scheduled (across all batches): ${summary.labs}`);
      console.log(` - Subjects scheduled: ${Array.from(summary.subjects).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
