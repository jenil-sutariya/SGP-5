import {
  PrismaClient,
  RoleName,
  DayOfWeek,
  RoomTypeName,
  SubjectType,
  DifficultyLevel,
  ConstraintType,
  PreferenceType,
  NotificationType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';

let prisma = new PrismaClient();

export function setPrisma(instance: any) {
  prisma = instance;
}

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

// ─── Truncate all tables ──────────────────────────────────────────────────────

async function resetData() {
  const tables = [
    'practical_batches',
    'special_events',
    'timetable_conflicts',
    'timetable_entries',
    'timetables',
    'notifications',
    'audit_logs',
    'password_resets',
    'refresh_tokens',
    'user_settings',
    'faculty_leaves',
    'faculty_preferences',
    'faculty_availability',
    'course_assignments',
    'course_offerings',
    'course_subjects',
    'subject_requirements',
    'students',
    'faculty',
    'sections',
    'student_batches',
    'courses',
    'subjects',
    'laboratories',
    'rooms',
    'holidays',
    'semesters',
    'academic_years',
    'programs',
    'users',
    'departments',
    'buildings',
    'institutes',
    'time_slots',
    'days',
    'room_types',
    'roles',
    'settings',
    'constraints',
  ];
  for (const t of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`);
    } catch {
      // table may not exist yet during first migration
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DeptDef = {
  code: string;
  name: string;
  subjects: SubjectDef[];
};

type SubjectDef = {
  code: string;
  name: string;
  weeklyHours: number;
  credits: number;
  type: SubjectType;
  requiresLab: boolean;
  labHours: number;
  difficulty: DifficultyLevel;
  semesterNo: number;
};

async function seedInstitute(opts: {
  code: string;
  name: string;
  fullName: string;
  description: string;
  adminEmail: string;
  adminFirst: string;
  adminLast: string;
  roleMap: Record<RoleName, string>;
  departments: DeptDef[];
  buildingCode: string;
  buildingName: string;
  buildingAddress: string;
}) {
  const institute = await prisma.institute.create({
    data: {
      code: opts.code,
      name: opts.name,
      fullName: opts.fullName,
      description: opts.description,
    },
  });

  const building = await prisma.building.create({
    data: {
      code: opts.buildingCode,
      name: opts.buildingName,
      floors: 4,
      address: opts.buildingAddress,
      instituteId: institute.id,
      description: opts.fullName,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: opts.adminEmail,
      passwordHash: await hash('Admin@123'),
      firstName: opts.adminFirst,
      lastName: 'Admin',
      roleId: opts.roleMap[RoleName.INSTITUTE_ADMIN],
      instituteId: institute.id,
      emailVerified: true,
      settings: { create: {} },
    },
  });

  await prisma.institute.update({
    where: { id: institute.id },
    data: { adminUserId: admin.id },
  });

  const deptMap: Record<string, { id: string; code: string; programId: string }> = {};

  for (const d of opts.departments) {
    const dept = await prisma.department.create({
      data: {
        code: d.code,
        name: d.name,
        instituteId: institute.id,
        buildingId: building.id,
        description: `${opts.code} – ${d.code} Department`,
      },
    });
    const program = await prisma.program.create({
      data: {
        code: `${opts.code}-${d.code}-BTECH`,
        name: `B.Tech. ${d.name}`,
        degree: 'B.Tech',
        durationYears: 4,
        departmentId: dept.id,
      },
    });
    deptMap[d.code] = { id: dept.id, code: d.code, programId: program.id };
  }

  return { institute, building, admin, deptMap };
}

function getSubjectsForSemester(originalSubjects: SubjectDef[], semNo: number): SubjectDef[] {
  return originalSubjects.filter((s) => s.semesterNo === semNo);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runSeed() {
  console.log('🌱 Seeding CHARUSAT SmartSched database…');
  await resetData();

  const studentPasswordHash = await hash('Student@123');

  // ── Roles ─────────────────────────────────────────────────────────────────
  const roleDefs = [
    { name: RoleName.ADMIN,            description: 'CHARUSAT University Admin',     permissions: ['*'] },
    { name: RoleName.INSTITUTE_ADMIN,  description: 'Institute Admin (CSPIT/DEPSTAR)', permissions: ['institute.*', 'department.*', 'faculty.*', 'students.*', 'rooms.*', 'batches.*'] },
    { name: RoleName.DEPARTMENT_HEAD,  description: 'Head of Department',            permissions: ['department.*', 'faculty.*', 'students.*'] },
    { name: RoleName.FACULTY,          description: 'Faculty / Professor',           permissions: ['timetable.view', 'availability.*', 'leaves.*'] },
    { name: RoleName.STUDENT,          description: 'Student',                       permissions: ['timetable.view'] },
    { name: RoleName.SCHEDULER,        description: 'Timetable Officer',             permissions: ['scheduler.*', 'timetable.*'] },
  ];
  for (const r of roleDefs) {
    await prisma.role.upsert({
      where:  { name: r.name },
      create: { name: r.name, description: r.description, permissions: r.permissions },
      update: { description: r.description, permissions: r.permissions },
    });
  }
  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id])) as Record<RoleName, string>;

  // ── Days ──────────────────────────────────────────────────────────────────
  const dayDefs = [
    { name: DayOfWeek.MONDAY,    shortName: 'Mon', order: 1, isWorking: true  },
    { name: DayOfWeek.TUESDAY,   shortName: 'Tue', order: 2, isWorking: true  },
    { name: DayOfWeek.WEDNESDAY, shortName: 'Wed', order: 3, isWorking: true  },
    { name: DayOfWeek.THURSDAY,  shortName: 'Thu', order: 4, isWorking: true  },
    { name: DayOfWeek.FRIDAY,    shortName: 'Fri', order: 5, isWorking: true  },
    { name: DayOfWeek.SATURDAY,  shortName: 'Sat', order: 6, isWorking: true  },
    { name: DayOfWeek.SUNDAY,    shortName: 'Sun', order: 7, isWorking: false },
  ];
  for (const d of dayDefs) {
    await prisma.day.upsert({ where: { name: d.name }, create: d, update: d });
  }
  const days = await prisma.day.findMany({ orderBy: { order: 'asc' } });
  const workingDays = days.filter((d) => d.isWorking);

  // ── Time Slots (global — not day-specific) ────────────────────────────────
  // Time slots: 6 teaching periods + Lunch Break + Short Break
  // Valid lab pairs (2 consecutive): P1+P2, P3+P4, P5+P6
  const slotDefs = [
    { name: 'Period 1',    startTime: '09:10', endTime: '10:10', order: 1, isLunchBreak: false, durationMins: 60 },
    { name: 'Period 2',    startTime: '10:10', endTime: '11:10', order: 2, isLunchBreak: false, durationMins: 60 },
    { name: 'Lunch Break', startTime: '11:10', endTime: '12:10', order: 3, isLunchBreak: true,  durationMins: 60 },
    { name: 'Period 3',    startTime: '12:10', endTime: '13:10', order: 4, isLunchBreak: false, durationMins: 60 },
    { name: 'Period 4',    startTime: '13:10', endTime: '14:10', order: 5, isLunchBreak: false, durationMins: 60 },
    { name: 'Short Break', startTime: '14:10', endTime: '14:20', order: 6, isLunchBreak: true,  durationMins: 10 },
    { name: 'Period 5',    startTime: '14:20', endTime: '15:20', order: 7, isLunchBreak: false, durationMins: 60 },
    { name: 'Period 6',    startTime: '15:20', endTime: '16:20', order: 8, isLunchBreak: false, durationMins: 60 },
  ];
  for (const s of slotDefs) await prisma.timeSlot.create({ data: s });
  const timeSlots = await prisma.timeSlot.findMany({ orderBy: { order: 'asc' } });
  const teachingSlots = timeSlots.filter((s) => !s.isLunchBreak);

  // ── Room Types ────────────────────────────────────────────────────────────
  for (const name of Object.values(RoomTypeName)) {
    await prisma.roomType.upsert({
      where:  { name },
      create: { name, description: name.replace(/_/g, ' ') },
      update: {},
    });
  }
  const classroomType = await prisma.roomType.findUniqueOrThrow({ where: { name: RoomTypeName.CLASSROOM } });

  // ── University Admin + Scheduler ──────────────────────────────────────────
  const uniAdmin = await prisma.user.create({
    data: {
      email: 'admin@charusat.edu.in',
      passwordHash: await hash('Admin@123'),
      firstName: 'CHARUSAT',
      lastName: 'Admin',
      roleId: roleMap[RoleName.ADMIN],
      emailVerified: true,
      settings: { create: {} },
    },
  });

  await prisma.user.create({
    data: {
      email: 'timetable@charusat.edu.in',
      passwordHash: await hash('Scheduler@123'),
      firstName: 'Timetable',
      lastName: 'Officer',
      roleId: roleMap[RoleName.SCHEDULER],
      emailVerified: true,
      settings: { create: {} },
    },
  });

  function generateSyllabus(deptCode: string, prefix: string): SubjectDef[] {
    const isComputer = ['CSE', 'CE', 'IT'].includes(deptCode);
    const subjects: SubjectDef[] = [];
    
    // Semester 1
    subjects.push({ code: 'MA101', name: 'Engineering Mathematics-I', weeklyHours: 3, credits: 4, type: SubjectType.THEORY, requiresLab: false, labHours: 0, difficulty: DifficultyLevel.HARD, semesterNo: 1 });
    subjects.push({ code: 'CS101', name: 'Computer Programming', weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 1 });
    subjects.push({ code: 'PY101', name: 'Engineering Physics', weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 1 });
    subjects.push({ code: 'EE101', name: 'Basic Electrical Engineering', weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 1 });
    subjects.push({ code: 'ME102', name: 'Engineering Graphics & Design', weeklyHours: 2, credits: 4, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 1 });
    subjects.push({ code: 'HS101', name: 'Communication Skills', weeklyHours: 2, credits: 3, type: SubjectType.THEORY, requiresLab: false, labHours: 0, difficulty: DifficultyLevel.EASY, semesterNo: 1 });

    // Semester 3
    subjects.push({ code: 'MA201', name: isComputer ? 'Discrete Mathematics' : 'Engineering Mathematics-III', weeklyHours: 3, credits: 4, type: SubjectType.THEORY, requiresLab: false, labHours: 0, difficulty: DifficultyLevel.HARD, semesterNo: 3 });
    subjects.push({ code: 'SUB201', name: `${deptCode} Subject 1`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 3 });
    subjects.push({ code: 'SUB202', name: `${deptCode} Subject 2`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 3 });
    subjects.push({ code: 'SUB203', name: `${deptCode} Subject 3`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 3 });
    subjects.push({ code: 'SUB204', name: `${deptCode} Subject 4`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 3 });
    subjects.push({ code: 'HS201', name: 'Professional Ethics', weeklyHours: 2, credits: 2, type: SubjectType.THEORY, requiresLab: false, labHours: 0, difficulty: DifficultyLevel.EASY, semesterNo: 3 });

    // Semester 5
    subjects.push({ code: 'SUB301', name: `${deptCode} Core-1`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 5 });
    subjects.push({ code: 'SUB302', name: `${deptCode} Core-2`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 5 });
    subjects.push({ code: 'SUB303', name: `${deptCode} Core-3`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 5 });
    subjects.push({ code: 'SUB304', name: `${deptCode} Theory Elective`, weeklyHours: 3, credits: 4, type: SubjectType.THEORY, requiresLab: false, labHours: 0, difficulty: DifficultyLevel.MEDIUM, semesterNo: 5 });
    subjects.push({ code: 'SUB305', name: `${deptCode} Core-4`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 5 });
    subjects.push({ code: 'SUB306', name: `${deptCode} Core-5`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 5 });

    // Semester 7
    subjects.push({ code: 'SUB401', name: `${deptCode} Advanced-1`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 7 });
    subjects.push({ code: 'SUB402', name: `${deptCode} Advanced-2`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 7 });
    subjects.push({ code: 'SUB403', name: `${deptCode} Advanced-3`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 7 });
    subjects.push({ code: 'SUB404', name: `${deptCode} Policy Elective`, weeklyHours: 3, credits: 4, type: SubjectType.THEORY, requiresLab: false, labHours: 0, difficulty: DifficultyLevel.MEDIUM, semesterNo: 7 });
    subjects.push({ code: 'SUB405', name: `${deptCode} Advanced-4`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.MEDIUM, semesterNo: 7 });
    subjects.push({ code: 'SUB406', name: `${deptCode} Advanced-5`, weeklyHours: 3, credits: 5, type: SubjectType.THEORY, requiresLab: true, labHours: 2, difficulty: DifficultyLevel.HARD, semesterNo: 7 });

    // Replace placeholder names with realistic names per department
    const realNames: Record<string, Record<string, string>> = {
      CSE: {
        'SUB201': 'Data Structures & Algorithms',
        'SUB202': 'Database Management Systems',
        'SUB203': 'Digital Logic Design',
        'SUB204': 'Object Oriented Programming',
        'SUB301': 'Computer Networks',
        'SUB302': 'Operating Systems',
        'SUB303': 'Software Engineering',
        'SUB304': 'Theory of Computation',
        'SUB305': 'Web Technologies',
        'SUB306': 'Analysis & Design of Algorithms',
        'SUB401': 'Compiler Design',
        'SUB402': 'Artificial Intelligence',
        'SUB403': 'Cloud Computing',
        'SUB404': 'Information Security',
        'SUB405': 'Distributed Systems',
        'SUB406': 'Mobile Application Development'
      },
      CE: {
        'SUB201': 'OOP using C++',
        'SUB202': 'Computer Organization & Architecture',
        'SUB203': 'Data Structures',
        'SUB204': 'Digital Systems',
        'SUB301': 'Design & Analysis of Algorithms',
        'SUB302': 'Microprocessor & Interfacing',
        'SUB303': 'Database Management Systems',
        'SUB304': 'Theory of Computation',
        'SUB305': 'System Programming',
        'SUB306': 'Computer Networks',
        'SUB401': 'Embedded Systems',
        'SUB402': 'Machine Learning',
        'SUB403': 'Cryptography',
        'SUB404': 'Distributed Systems',
        'SUB405': 'Image Processing',
        'SUB406': 'Big Data Analytics'
      },
      IT: {
        'SUB201': 'Java Programming',
        'SUB202': 'Web Design & Development',
        'SUB203': 'Database Systems',
        'SUB204': 'Data Structures',
        'SUB301': 'Operating Systems',
        'SUB302': 'Software Project Management',
        'SUB303': 'Design and Analysis of Algorithms',
        'SUB304': 'Automata Theory',
        'SUB305': 'Cyber Security',
        'SUB306': 'Computer Networks',
        'SUB401': 'Internet of Things',
        'SUB402': 'Cryptography',
        'SUB403': 'Data Mining & Warehousing',
        'SUB404': 'E-Commerce Technologies',
        'SUB405': 'Cloud Technology',
        'SUB406': 'Big Data Analytics'
      },
      EC: {
        'SUB201': 'Circuit Theory',
        'SUB202': 'Electronic Devices',
        'SUB203': 'Digital Electronics',
        'SUB204': 'Signals & Systems',
        'SUB301': 'Analog Communication',
        'SUB302': 'Electromagnetics',
        'SUB303': 'Microcontrollers & Applications',
        'SUB304': 'Linear Integrated Circuits',
        'SUB305': 'Digital Communication',
        'SUB306': 'Control Systems',
        'SUB401': 'VLSI Design',
        'SUB402': 'Antenna & Wave Propagation',
        'SUB403': 'Fiber Optic Communication',
        'SUB404': 'Microwave Engineering',
        'SUB405': 'Digital Signal Processing',
        'SUB406': 'Wireless Communication'
      },
      EE: {
        'SUB201': 'Electrical Circuits',
        'SUB202': 'Electromagnetic Fields',
        'SUB203': 'Electrical Measurement',
        'SUB204': 'Analog Electronics',
        'SUB301': 'Electrical Machines-I',
        'SUB302': 'Power Electronics',
        'SUB303': 'Control Systems',
        'SUB304': 'Power Systems-I',
        'SUB305': 'Microprocessors & Interfacing',
        'SUB306': 'Electrical Machines-II',
        'SUB401': 'Power System Protection',
        'SUB402': 'Renewable Energy Sources',
        'SUB403': 'High Voltage Engineering',
        'SUB404': 'Electrical Drives & Control',
        'SUB405': 'Power Quality',
        'SUB406': 'Smart Grids'
      },
      ME: {
        'SUB201': 'Engineering Mechanics',
        'SUB202': 'Material Science',
        'SUB203': 'Manufacturing Processes-I',
        'SUB204': 'Fluid Mechanics',
        'SUB301': 'Machine Design-I',
        'SUB302': 'Dynamics of Machinery',
        'SUB303': 'Heat Transfer',
        'SUB304': 'Thermodynamics-II',
        'SUB305': 'Manufacturing Processes-II',
        'SUB306': 'Fluid Machinery',
        'SUB401': 'CAD/CAM',
        'SUB402': 'Refrigeration & AC',
        'SUB403': 'Power Plant Engineering',
        'SUB404': 'Automobile Engineering',
        'SUB405': 'Finite Element Analysis',
        'SUB406': 'Operations Research'
      },
      CIVIL: {
        'SUB201': 'Surveying',
        'SUB202': 'Strength of Materials',
        'SUB203': 'Building Construction',
        'SUB204': 'Fluid Mechanics',
        'SUB301': 'Structural Analysis',
        'SUB302': 'Concrete Technology',
        'SUB303': 'Geotechnical Engineering-I',
        'SUB304': 'Environmental Engineering-I',
        'SUB305': 'Transportation Engineering-I',
        'SUB306': 'Hydrology & Water Resources',
        'SUB401': 'Water Resources Engineering',
        'SUB402': 'Geotechnical Engineering-II',
        'SUB403': 'Structural Design',
        'SUB404': 'Transportation Engineering-II',
        'SUB405': 'Quantity Surveying & Estimation',
        'SUB406': 'Construction Management'
      }
    };

    const namesMap = realNames[deptCode];
    if (namesMap) {
      for (const sub of subjects) {
        if (namesMap[sub.code]) {
          sub.name = namesMap[sub.code];
          sub.code = deptCode + sub.code.substring(3);
        }
      }
    }

    return subjects;
  }

  // ── CSPIT Departments & Subjects ──────────────────────────────────────────
  const cspitDepts: DeptDef[] = [
    { code: 'CSE', name: 'Computer Science & Engineering', subjects: [] },
    { code: 'CE', name: 'Computer Engineering', subjects: [] },
    { code: 'IT', name: 'Information Technology', subjects: [] },
    { code: 'EC', name: 'Electronics & Communication', subjects: [] },
    { code: 'EE', name: 'Electrical Engineering', subjects: [] },
    { code: 'ME', name: 'Mechanical Engineering', subjects: [] },
    { code: 'CIVIL', name: 'Civil Engineering', subjects: [] },
  ];

  const depstarDepts: DeptDef[] = [
    { code: 'CSE', name: 'Computer Science & Engineering', subjects: [] },
    { code: 'CE', name: 'Computer Engineering', subjects: [] },
    { code: 'IT', name: 'Information Technology', subjects: [] },
  ];

  // ── Seed Institutes ───────────────────────────────────────────────────────
  const cspit = await seedInstitute({
    code: 'CSPIT', name: 'CSPIT',
    fullName: 'Chandubhai S. Patel Institute of Technology',
    description: 'Engineering institute – CHARUSAT University, Changa',
    adminEmail: 'admin.cspit@charusat.edu.in',
    adminFirst: 'CSPIT',
    roleMap,
    buildingCode: 'CSPIT-MAIN', buildingName: 'CSPIT Main Block',
    buildingAddress: 'CSPIT Campus, Changa, Anand - 388421',
    departments: cspitDepts,
    adminLast: ''
  });

  const depstar = await seedInstitute({
    code: 'DEPSTAR', name: 'DEPSTAR',
    fullName: 'Devang Patel Institute of Advance Technology & Research',
    description: 'DEPSTAR – CHARUSAT University, Changa',
    adminEmail: 'admin.depstar@charusat.edu.in',
    adminFirst: 'DEPSTAR',
    roleMap,
    buildingCode: 'DEPSTAR-MAIN', buildingName: 'DEPSTAR Main Block',
    buildingAddress: 'DEPSTAR Campus, Changa, Anand - 388421',
    departments: depstarDepts,
    adminLast: ''
  });

  // ── Academic Year & Semesters ─────────────────────────────────────────────
  const ay = await prisma.academicYear.create({
    data: {
      name: '2025-26',
      startDate: new Date('2025-07-01'),
      endDate:   new Date('2026-06-30'),
      isCurrent: true,
    },
  });

  const oddSem = await prisma.semester.create({
    data: {
      name: 'Odd Semester 2025-26',
      number: 1,
      academicYearId: ay.id,
      startDate: new Date('2025-07-15'),
      endDate:   new Date('2025-12-20'),
      isCurrent: true,
    },
  });

  await prisma.semester.create({
    data: {
      name: 'Even Semester 2025-26',
      number: 2,
      academicYearId: ay.id,
      startDate: new Date('2026-01-10'),
      endDate:   new Date('2026-05-30'),
      isCurrent: false,
    },
  });

  // ── Helper: add rooms ─────────────────────────────────────────────────────
  async function addRooms(prefix: string, buildingId: string, deptId: string | null, count: number) {
    for (let i = 1; i <= count; i++) {
      await prisma.room.create({
        data: {
          code: `${prefix}-R${100 + i}`,
          name: `${prefix} Room ${100 + i}`,
          buildingId,
          departmentId: deptId && i <= 2 ? deptId : null,
          roomTypeId: classroomType.id,
          floor: Math.ceil(i / 3),
          capacity: i <= 2 ? 30 : 60,
          hasProjector: true,
          hasAC: i <= 4,
        },
      });
    }
  }

  async function addLabs(prefix: string, buildingId: string, deptId: string, count: number) {
    // Create 'count' small labs (20 students each — one per batch)
    for (let i = 1; i <= count; i++) {
      await prisma.laboratory.create({
        data: {
          code: `${prefix}-LAB${i}`,
          name: `${prefix} Lab ${i}`,
          buildingId,
          departmentId: deptId,
          floor: i,
          capacity: 20,          // fits exactly one 20-student batch
          labType: 'COMPUTER',
          equipment: 'i5 workstations, 20 nodes, 1 Gbps LAN',
        },
      });
    }
    // Also create 1 combined lab (40 students) — allows 2 batches simultaneously
    await prisma.laboratory.create({
      data: {
        code: `${prefix}-BIGLAB`,
        name: `${prefix} Combined Lab`,
        buildingId,
        departmentId: deptId,
        floor: count + 1,
        capacity: 40,
        labType: 'COMPUTER',
        equipment: 'i5 workstations, 40 nodes, 1 Gbps LAN',
      },
    });
  }

  // ── Global Classrooms Setup ──────────────────────────────────────────────
  await addRooms('CSPIT', cspit.building.id, null, 35);
  await addRooms('DEPSTAR', depstar.building.id, null, 15);

  const institutesToSeed = [
    { inst: cspit, prefix: 'CSPIT' },
    { inst: depstar, prefix: 'DEPSTAR' }
  ];

  for (const { inst, prefix } of institutesToSeed) {
    const deptList = prefix === 'CSPIT' ? cspitDepts : depstarDepts;
    for (const deptCode of Object.keys(inst.deptMap)) {
      const dept = inst.deptMap[deptCode];
      const origDept = deptList.find((d) => d.code === deptCode);
      const originalSubjects = generateSyllabus(deptCode, prefix);

      // Create 2 specific laboratories for this department
      await addLabs(`${prefix}-${deptCode}`, inst.building.id, dept.id, 2);

      // Create 15 faculty members for this department
      const deptFaculty = [];
      const designations = [
        'Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor', 'Lecturer',
        'Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor', 'Lecturer',
        'Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor', 'Lecturer'
      ];
      const firstNames = [
        'Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram',
        'Sanjay', 'Nehal', 'Ketan', 'Arpita', 'Hardik',
        'Vijay', 'Dipti', 'Nilesh', 'Rina', 'Jignesh'
      ];
      const lastNames = [
        'Sharma', 'Patel', 'Mehta', 'Joshi', 'Chauhan',
        'Shah', 'Pandya', 'Trivedi', 'Rana', 'Dave',
        'Vyas', 'Gajjar', 'Panchal', 'Mistry', 'Solanki'
      ];

      for (let fIdx = 1; fIdx <= 15; fIdx++) {
        const user = await prisma.user.create({
          data: {
            email: `prof${fIdx}.${deptCode.toLowerCase()}.${prefix.toLowerCase()}@charusat.edu.in`,
            passwordHash: await hash('Faculty@123'),
            firstName: firstNames[fIdx - 1],
            lastName: `${lastNames[fIdx - 1]} (${deptCode})`,
            roleId: roleMap[RoleName.FACULTY],
            departmentId: dept.id,
            instituteId: inst.institute.id,
            emailVerified: true,
            settings: { create: {} },
          },
        });

        const fac = await prisma.faculty.create({
          data: {
            employeeId: `${prefix}/${deptCode}/${String(fIdx).padStart(3, '0')}`,
            userId: user.id,
            departmentId: dept.id,
            designation: designations[fIdx - 1],
            specialization: `${deptCode} Specialization`,
            maxHoursPerWeek: 24,
            maxHoursPerDay: 6,
            joiningDate: new Date('2020-07-01'),
          },
        });

        deptFaculty.push(fac);

        // Faculty Availability
        await prisma.facultyAvailability.createMany({
          data: workingDays.flatMap((d) =>
            teachingSlots.map((s) => ({
              facultyId: fac.id,
              dayId: d.id,
              timeSlotId: s.id,
              isAvailable: true,
            }))
          ),
        });

        // Faculty morning preference
        await prisma.facultyPreference.create({
          data: {
            facultyId: fac.id,
            timeSlotId: teachingSlots[0].id,
            preferenceType: PreferenceType.PREFERRED,
            weight: 8,
            notes: 'Prefers morning lectures',
          },
        });
      }

      let offeringIndex = 0;

      // Loop over semesters 1, 3, 5, 7 (representing years 1, 2, 3, 4)
      const semestersToSeed = [
        { semNo: 1, year: 1, batchYear: 2025 },
        { semNo: 3, year: 2, batchYear: 2024 },
        { semNo: 5, year: 3, batchYear: 2023 },
        { semNo: 7, year: 4, batchYear: 2022 }
      ];

      for (const { semNo, year, batchYear } of semestersToSeed) {
        const subjectsForSem = getSubjectsForSemester(originalSubjects, semNo);

        const createdSubjects = [];
        for (const s of subjectsForSem) {
          const isBoth = s.type === SubjectType.THEORY && s.requiresLab && s.labHours > 0;
          
          if (isBoth) {
            // 1. Create Theory subject
            const theorySub = await prisma.subject.create({
              data: {
                code: `${prefix}-${deptCode}-${s.code}-${semNo}-TH`,
                name: `${s.name} (Theory)`,
                credits: s.credits - 1 || 3,
                weeklyHours: 4,
                type: SubjectType.THEORY,
                difficulty: s.difficulty,
                requiresLab: false,
                labHours: 0,
                departmentId: dept.id,
              },
            });
            createdSubjects.push(theorySub);
            
            // 2. Create Lab subject
            const labSub = await prisma.subject.create({
              data: {
                code: `${prefix}-${deptCode}-${s.code}-${semNo}-PR`,
                name: `${s.name} (PR)`,
                credits: 1,
                weeklyHours: s.labHours,
                type: SubjectType.LAB,
                difficulty: s.difficulty,
                requiresLab: true,
                labHours: s.labHours,
                departmentId: dept.id,
              },
            });
            createdSubjects.push(labSub);
          } else {
            // Create single subject (Theory or Lab only)
            const sub = await prisma.subject.create({
              data: {
                code: `${prefix}-${deptCode}-${s.code}-${semNo}`,
                name: s.name,
                credits: s.credits,
                weeklyHours: s.type === SubjectType.THEORY ? 4 : s.labHours,
                type: s.type,
                difficulty: s.difficulty,
                requiresLab: s.type === SubjectType.LAB || s.requiresLab,
                labHours: s.labHours,
                departmentId: dept.id,
              },
            });
            createdSubjects.push(sub);
          }
        }

        // Create Course
        const course = await prisma.course.create({
          data: {
            code: `${prefix}-${deptCode}-SEM${semNo}`,
            name: `${prefix} ${deptCode} Semester ${semNo}`,
            departmentId: dept.id,
            programId: dept.programId,
            semesterNo: semNo,
            totalCredits: createdSubjects.reduce((acc, s) => acc + s.credits, 0),
            courseSubjects: { create: createdSubjects.map((s) => ({ subjectId: s.id })) },
          },
        });

        // Create StudentBatch
        const batch = await prisma.studentBatch.create({
          data: {
            name: `${prefix} ${deptCode} Batch ${batchYear}-${batchYear + 4}`,
            code: `${prefix}-${deptCode}-${batchYear}`,
            instituteId: inst.institute.id,
            departmentId: dept.id,
            programId: dept.programId,
            batchYear: batchYear,
            semesterNo: semNo,
            capacity: 60,
          },
        });

        for (let div = 1; div <= 2; div++) {
          // Create Section
          const section = await prisma.section.create({
            data: {
              name: `${prefix} ${semNo}${deptCode}${div}`,
              code: `${prefix}-${semNo}${deptCode}${div}`,
              departmentId: dept.id,
              programId: dept.programId,
              semesterId: oddSem.id,
              batchId: batch.id,
              capacity: 60,
              year: year,
            },
          });

          // Create 3 Practical Batches
          const pBatches = [];
          for (let i = 0; i < 3; i++) {
            const letter = String.fromCharCode(65 + i);
            pBatches.push(
              await prisma.practicalBatch.create({
                data: {
                  name: `${semNo}${deptCode}${div}-${letter}`,
                  code: `${section.code}-${letter}`,
                  sectionId: section.id,
                  capacity: 20,
                },
              })
            );
          }

          // Create CourseOfferings & Assignments for ALL subjects
          const deptLabs = await prisma.laboratory.findMany({ where: { departmentId: dept.id } });

          for (let i = 0; i < createdSubjects.length; i++) {
            const subject = createdSubjects[i];
            const offering = await prisma.courseOffering.create({
              data: {
                courseId: course.id,
                subjectId: subject.id,
                semesterId: oddSem.id,
                sectionId: section.id,
                maxStudents: 60,
              },
            });

             // Assign primary faculty using round-robin — every subject gets a faculty (multiple subjects per faculty is fine)
            const primaryFaculty = deptFaculty[offeringIndex % deptFaculty.length];
            await prisma.courseAssignment.create({
              data: {
                courseOfferingId: offering.id,
                facultyId: primaryFaculty.id,
                isPrimary: true,
              },
            });

            // For THEORY-type subjects: add a secondary faculty assignment to ensure multiple professors can conduct it
            if (!subject.requiresLab && subject.type === SubjectType.THEORY) {
              const secFaculty = deptFaculty[(offeringIndex + 3) % deptFaculty.length];
              if (secFaculty.id !== primaryFaculty.id) {
                await prisma.courseAssignment.create({
                  data: {
                    courseOfferingId: offering.id,
                    facultyId: secFaculty.id,
                    isPrimary: false,
                  },
                });
              }
            }

            // For LAB-type subjects: add two secondary (lab instructor) faculty assignments to ensure 3 distinct faculty members per lab
            if (subject.requiresLab || subject.type === SubjectType.LAB) {
              const sec1 = deptFaculty[(offeringIndex + 5) % deptFaculty.length];
              const sec2 = deptFaculty[(offeringIndex + 10) % deptFaculty.length];
              
              if (sec1.id !== primaryFaculty.id) {
                await prisma.courseAssignment.create({
                  data: {
                    courseOfferingId: offering.id,
                    facultyId: sec1.id,
                    isPrimary: false,
                  },
                });
              }
              if (sec2.id !== primaryFaculty.id && sec2.id !== sec1.id) {
                await prisma.courseAssignment.create({
                  data: {
                    courseOfferingId: offering.id,
                    facultyId: sec2.id,
                    isPrimary: false,
                  },
                });
              }
            }

            offeringIndex++;
          }

          // Create 60 students for this section/batch (total 120 students per semester across 2 sections)
          const instShort = prefix === 'DEPSTAR' ? 'DS' : '';
          const studentPromises = [];
          const startIdx = (div - 1) * 60 + 1;
          const endIdx = div * 60;
          for (let sIdx = startIdx; sIdx <= endIdx; sIdx++) {
            const enroll = `${String(batchYear).slice(2)}${instShort}${deptCode}${String(sIdx).padStart(3, '0')}`;
            const batchIdx = Math.floor((sIdx - startIdx) / 20);
            const pBatchId = pBatches[batchIdx]?.id;

            studentPromises.push((async () => {
              const user = await prisma.user.create({
                data: {
                  email: `${enroll.toLowerCase()}@charusat.edu.in`,
                  passwordHash: studentPasswordHash,
                  firstName: 'Student',
                  lastName: enroll,
                  roleId: roleMap[RoleName.STUDENT],
                  departmentId: dept.id,
                  instituteId: inst.institute.id,
                  emailVerified: true,
                  settings: { create: {} },
                },
              });

              await prisma.student.create({
                data: {
                  enrollmentNo: enroll,
                  userId: user.id,
                  departmentId: dept.id,
                  sectionId: section.id,
                  batchId: batch.id,
                  practicalBatchId: pBatchId || null,
                  batchYear: batchYear,
                  currentSemester: semNo,
                },
              });
            })());
          }
          await Promise.all(studentPromises);
        }
      }
    }
  }

  // ── Constraints ───────────────────────────────────────────────────────────
  const constraints = [
    { name: 'NO_FACULTY_CLASH',       type: ConstraintType.HARD, category: 'faculty',  weight: 100, description: 'Faculty cannot teach two classes simultaneously' },
    { name: 'NO_ROOM_CLASH',          type: ConstraintType.HARD, category: 'room',     weight: 100, description: 'No two classes in the same room at the same time' },
    { name: 'NO_LAB_CLASH',           type: ConstraintType.HARD, category: 'lab',      weight: 100, description: 'No two classes in the same lab at the same time' },
    { name: 'NO_SECTION_CLASH',       type: ConstraintType.HARD, category: 'section',  weight: 100, description: 'A section cannot have two classes at the same time' },
    { name: 'RESPECT_BREAKS',         type: ConstraintType.HARD, category: 'time',     weight: 100, description: 'No teaching during Tea Break or Lunch periods' },
    { name: 'WORKING_DAYS_ONLY',      type: ConstraintType.HARD, category: 'time',     weight: 100, description: 'Classes only Monday to Saturday' },
    { name: 'LAB_REQUIRES_LABORATORY',type: ConstraintType.HARD, category: 'lab',      weight: 100, description: 'Lab subjects must be scheduled in a laboratory room' },
    { name: 'ROOM_CAPACITY',          type: ConstraintType.HARD, category: 'room',     weight: 90,  description: 'Room capacity must not be exceeded' },
    { name: 'MAX_FACULTY_DAILY_LOAD', type: ConstraintType.HARD, category: 'faculty',  weight: 80,  description: 'Faculty cannot exceed max hours per day' },
    { name: 'FACULTY_AVAILABILITY',   type: ConstraintType.HARD, category: 'faculty',  weight: 100, description: 'Only schedule faculty when they are available' },
    { name: 'FACULTY_PREFERRED_SLOTS',type: ConstraintType.SOFT, category: 'faculty',  weight: 40,  description: 'Prefer faculty preferred time slots' },
    { name: 'WORKLOAD_BALANCE',       type: ConstraintType.SOFT, category: 'faculty',  weight: 35,  description: 'Balance teaching workload across faculty' },
    { name: 'AVOID_CONSECUTIVE_LABS', type: ConstraintType.SOFT, category: 'lab',      weight: 20,  description: 'Avoid scheduling too many consecutive lab sessions' },
  ];
  for (const c of constraints) {
    await prisma.constraint.upsert({
      where:  { name: c.name },
      create: { ...c, config: {} },
      update: { description: c.description, weight: c.weight },
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = [
    { key: 'university_name',   value: 'Charotar University of Science and Technology', category: 'general',  label: 'University Name' },
    { key: 'university_code',   value: 'CHARUSAT',                                      category: 'general',  label: 'University Code' },
    { key: 'campus_location',   value: 'Changa, Anand, Gujarat - 388421',               category: 'general',  label: 'Campus Location' },
    { key: 'email_domain',      value: ['charusat.edu.in', 'charusat.ac.in'],           category: 'security', label: 'Allowed Email Domains' },
    { key: 'institutes',        value: ['CSPIT', 'DEPSTAR'],                            category: 'general',  label: 'Institutes' },
    { key: 'working_days',      value: ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'], category: 'schedule', label: 'Working Days' },
    { key: 'period_start_time', value: '09:10',                                         category: 'schedule', label: 'First Period Start' },
    { key: 'period_end_time',   value: '17:15',                                         category: 'schedule', label: 'Last Period End' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, create: s, update: { value: s.value } });
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId:  uniAdmin.id,
        title:   'SmartSched Initialized',
        message: 'CHARUSAT SmartSched is ready. CSPIT and DEPSTAR institute data has been seeded.',
        type:    NotificationType.SUCCESS,
      },
      {
        userId:  cspit.admin.id,
        title:   'Welcome, CSPIT Admin!',
        message: 'Your institute has been set up with CSE, SE, IT, AIML, Civil, ME and EC departments.',
        type:    NotificationType.INFO,
      },
      {
        userId:  depstar.admin.id,
        title:   'Welcome, DEPSTAR Admin!',
        message: 'Your institute has been set up with SCE, CE and IT departments.',
        type:    NotificationType.INFO,
      },
    ],
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed completed successfully!\n');
  console.log('──────────────────────────────────────────────');
  console.log('  🔑 Login Credentials:');
  console.log('──────────────────────────────────────────────');
  console.log('  University Admin   : admin@charusat.edu.in          / Admin@123');
  console.log('  CSPIT Admin        : admin.cspit@charusat.edu.in    / Admin@123');
  console.log('  DEPSTAR Admin      : admin.depstar@charusat.edu.in  / Admin@123');
  console.log('  Timetable Officer  : timetable@charusat.edu.in      / Scheduler@123');
  console.log('  CSPIT CSE Faculty  : prof1.cse.cspit@charusat.edu.in / Faculty@123');
  console.log('  DEPSTAR CE Faculty : prof1.ce.depstar@charusat.edu.in / Faculty@123');
  console.log('  CSPIT CSE Student  : 23cse001@charusat.edu.in       / Student@123');
  console.log('  DEPSTAR CE Student : 23ce001@charusat.edu.in        / Student@123');
  console.log('──────────────────────────────────────────────\n');
}

if (process.argv.slice(1).some((arg: string | string[]) => arg.includes('seed.ts') || arg.includes('seed.js'))) {
  runSeed()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
