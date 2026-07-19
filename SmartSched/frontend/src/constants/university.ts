/** CHARUSAT campus branding for the SmartSched frontend. */
export const UNIVERSITY = {
  shortName: 'CHARUSAT',
  fullName: 'Charotar University of Science and Technology',
  motto: 'Knowledge is eternal',
  campus: 'Changa, Anand, Gujarat',
  website: 'https://www.charusat.ac.in',
  productName: 'CHARUSAT Timetable',
  productTagline: 'CSPIT & DEPSTAR timetable portal for students & professors',
  primaryInstitute: 'CSPIT',
  emailDomains: ['charusat.edu.in', 'charusat.ac.in'],
  demoAdmin: 'admin.cspit@charusat.edu.in',
  demoPassword: 'Admin@123',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'University Admin',
  INSTITUTE_ADMIN: 'Institute Admin',
  DEPARTMENT_HEAD: 'HOD',
  FACULTY: 'Professor',
  STUDENT: 'Student',
  SCHEDULER: 'Timetable Officer',
};

export const INSTITUTES = {
  CSPIT: {
    code: 'CSPIT',
    name: 'CSPIT',
    fullName: 'Chandubhai S. Patel Institute of Technology',
    departments: ['CSE', 'SE', 'IT', 'AIML', 'CIVIL', 'ME', 'EC'],
  },
  DEPSTAR: {
    code: 'DEPSTAR',
    name: 'DEPSTAR',
    fullName: 'Devang Patel Institute of Advance Technology & Research',
    departments: ['SCE', 'CE', 'IT'],
  },
} as const;
