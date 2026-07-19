/** CHARUSAT campus configuration — SmartSched is locked to this university. */
export const UNIVERSITY = {
  shortName: 'CHARUSAT',
  fullName: 'Charotar University of Science and Technology',
  motto: 'Knowledge is eternal',
  campus: 'Changa, Anand, Gujarat 388421',
  website: 'https://www.charusat.ac.in',
  emailDomains: ['charusat.edu.in', 'charusat.ac.in'] as const,
  productName: 'CHARUSAT Timetable',
  productTagline: 'Official timetable portal for CHARUSAT students & professors',
  primaryInstitute: 'CSPIT',
  primaryInstituteFull: 'Chandubhai S. Patel Institute of Technology',
} as const;

export function isCharusatEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return UNIVERSITY.emailDomains.includes(domain as (typeof UNIVERSITY.emailDomains)[number]);
}
