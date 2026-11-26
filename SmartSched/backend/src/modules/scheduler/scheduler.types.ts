export interface SessionRequest {
  venueRequirements?: import('./venue.rules').VenueRequirement[];
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

export interface ExistingBooking {
  dayId: string;
  timeSlotId: string;
  facultyId: string;
  roomId?: string | null;
  laboratoryId?: string | null;
  sectionId?: string | null;
  practicalBatchId?: string | null;
}

export interface EngineContext {
  facultyTeachingDays?: Map<string, Set<string>>;
  calendarExceptions?: import('../timetable/occurrence.rules').CalendarExceptions;
  existingBookings?: ExistingBooking[];
  existingFacultyLoad?: { facultyId: string; dayId: string; hours: number }[];
  requests: SessionRequest[];
  workingDays: { id: string; order: number; name: string }[];
  timeSlots: {
    id: string;
    order: number;
    name: string;
    isLunchBreak: boolean;
    durationMins: number;
    startTime?: string;
    endTime?: string;
  }[];
  rooms: {
    roomTypeId?: string | null;
    equipment?: string | null;
    hasProjector?: boolean;
    hasAC?: boolean;
    hasWhiteboard?: boolean;
    id: string;
    capacity: number;
    departmentId: string | null;
    instituteId: string | null;
    code: string;
  }[];
  laboratories: {
    roomTypeId?: string | null;
    equipment?: string | null;
    id: string;
    capacity: number;
    departmentId: string;
    instituteId: string | null;
    code: string;
  }[];
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
