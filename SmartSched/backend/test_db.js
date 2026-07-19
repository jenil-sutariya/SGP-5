const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const departments = await prisma.department.findMany({
    include: {
      institute: true
    }
  });
  console.log('Departments count:', departments.length);
  departments.forEach(d => {
    console.log(`ID: ${d.id}, Code: ${d.code}, Name: ${d.name}, InstituteId: ${d.instituteId}, InstituteCode: ${d.institute?.code}`);
  });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
