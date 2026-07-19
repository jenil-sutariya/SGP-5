export interface SessionRequest {
  id: string;
  courseOfferingId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  difficulty: string;
  facultyId: string;
  sectionId: string | null;
  practicalBatchId?: string | null;
  departmentId: string;
  isLab: boolean;
  consecutiveSlots: number;
  requiredCapacity: number;
  priority: number;
}

export interface SlotCandidate {
  dayId: string;
  timeSlotId: string;
  dayOrder: number;
  slotOrder: number;
  roomId?: string;
  laboratoryId?: string;
  score: number;
}

export interface ScheduledAssignment {
  requestId: string;
  courseOfferingId: string;
  facultyId: string;
  sectionId: string | null;
  practicalBatchId?: string | null;
  dayId: string;
  timeSlotIds: string[];
  roomId?: string;
  laboratoryId?: string;
  isLab: boolean;
}

export interface EngineContext {
  requests: SessionRequest[];
  workingDays: { id: string; order: number; name: string }[];
  timeSlots: { id: string; order: number; name: string; isLunchBreak: boolean; durationMins: number }[];
  rooms: { id: string; capacity: number; departmentId: string | null; code: string }[];
  laboratories: { id: string; capacity: number; departmentId: string; code: string }[];
  facultyAvailability: Map<string, Set<string>>; // facultyId -> dayId|slotId available
  facultyPreferences: Map<string, { key: string; type: string; weight: number }[]>;
  facultyMaxPerDay: Map<string, number>;
  facultyMaxPerWeek: Map<string, number>;
  softConstraints: { name: string; weight: number; config: Record<string, unknown> }[];
  maxIterations: number;
  departmentCodes?: Map<string, string>;
  departmentInstitutes?: Map<string, string>;
  facultyNames?: Map<string, string>;
}

export interface EngineResult {
  assignments: ScheduledAssignment[];
  unassigned: SessionRequest[];
  score: number;
  iterations: number;
}
