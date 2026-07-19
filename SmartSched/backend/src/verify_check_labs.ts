import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Verifying rotated batch lab subject scheduling...');
  const latestTimetable = await prisma.timetable.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      entries: {
        where: {
          section: {
            name: 'DEPSTAR 7CSE1'
          },
          isLab: true
        },
        include: {
          section: true,
          practicalBatch: true,
          courseOffering: {
            include: {
              subject: true
            }
          },
          day: true,
          timeSlot: true,
          laboratory: true
        }
      }
    }
  });

  if (!latestTimetable) {
    console.log('No timetable found!');
    return;
  }

  console.log(`Timetable: ${latestTimetable.name}`);
  console.log('Rotated batch lab entries for DEPSTAR 7CSE1:');
  
  // Group by day and timeslot
  const slotsMap = new Map<string, any[]>();
  for (const entry of latestTimetable.entries) {
    const key = `${entry.day.name} - Slot ${entry.timeSlot.name} (${entry.timeSlot.startTime}-${entry.timeSlot.endTime})`;
    if (!slotsMap.has(key)) {
      slotsMap.set(key, []);
    }
    slotsMap.get(key)!.push(entry);
  }

  for (const [slot, entries] of slotsMap.entries()) {
    console.log(`\n📍 ${slot}:`);
    for (const e of entries) {
      console.log(`  Batch: ${e.practicalBatch?.name || 'All'} | Subject: ${e.courseOffering.subject.code} (${e.courseOffering.subject.name}) | Lab: ${e.laboratory?.code || 'None'}`);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
