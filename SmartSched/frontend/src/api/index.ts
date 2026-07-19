import api from '@/lib/axios';

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: Record<string, unknown>) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
};

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  roomUtilization: () => api.get('/analytics/room-utilization'),
  facultyWorkload: () => api.get('/analytics/faculty-workload'),
};

export const institutesApi = {
  list: () => api.get('/institutes'),
  get: (id: string) => api.get(`/institutes/${id}`),
};

export const departmentsApi = {
  list: (params?: Record<string, unknown>) => api.get('/departments', { params }),
  get: (id: string) => api.get(`/departments/${id}`),
  create: (data: unknown) => api.post('/departments', data),
  update: (id: string, data: unknown) => api.patch(`/departments/${id}`, data),
  remove: (id: string) => api.delete(`/departments/${id}`),
};

export const batchesApi = {
  list: (params?: Record<string, unknown>) => api.get('/batches', { params }),
  create: (data: unknown) => api.post('/batches', data),
  update: (id: string, data: unknown) => api.patch(`/batches/${id}`, data),
  remove: (id: string) => api.delete(`/batches/${id}`),
};

export const facultyApi = {
  list: (params?: Record<string, unknown>) => api.get('/faculty', { params }),
  get: (id: string) => api.get(`/faculty/${id}`),
  create: (data: unknown) => api.post('/faculty', data),
  update: (id: string, data: unknown) => api.patch(`/faculty/${id}`, data),
  remove: (id: string) => api.delete(`/faculty/${id}`),
  getAvailability: (id: string) => api.get(`/faculty/${id}/availability`),
  setAvailability: (id: string, slots: unknown) => api.put(`/faculty/${id}/availability`, { slots }),
  getAssignments: (id: string) => api.get(`/faculty/${id}/assignments`),
  updateAssignments: (id: string, courseOfferingIds: string[]) => api.post(`/faculty/${id}/assignments`, { courseOfferingIds }),
};

export const studentsApi = {
  list: (params?: Record<string, unknown>) => api.get('/students', { params }),
  create: (data: unknown) => api.post('/students', data),
  update: (id: string, data: unknown) => api.patch(`/students/${id}`, data),
  remove: (id: string) => api.delete(`/students/${id}`),
};

export const coursesApi = {
  list: (params?: Record<string, unknown>) => api.get('/courses', { params }),
  get: (id: string) => api.get(`/courses/${id}`),
  create: (data: unknown) => api.post('/courses', data),
  update: (id: string, data: unknown) => api.patch(`/courses/${id}`, data),
  remove: (id: string) => api.delete(`/courses/${id}`),
  listOfferings: () => api.get('/courses/offerings'),
  getCourseSubjects: (courseId: string) => api.get(`/courses/${courseId}/subjects`),
  getLabAssignments: (offeringId: string) => api.get(`/courses/offerings/${offeringId}/lab-assignments`),
  updateLabAssignments: (offeringId: string, assignments: { practicalBatchId: string; facultyId: string }[]) =>
    api.post(`/courses/offerings/${offeringId}/lab-assignments`, { assignments }),
};

export const subjectsApi = {
  list: (params?: Record<string, unknown>) => api.get('/subjects', { params }),
  create: (data: unknown) => api.post('/subjects', data),
  update: (id: string, data: unknown) => api.patch(`/subjects/${id}`, data),
  remove: (id: string) => api.delete(`/subjects/${id}`),
};

export const roomsApi = {
  list: (params?: Record<string, unknown>) => api.get('/rooms', { params }),
  types: () => api.get('/rooms/meta/types'),
  buildings: () => api.get('/rooms/meta/buildings'),
  create: (data: unknown) => api.post('/rooms', data),
  update: (id: string, data: unknown) => api.patch(`/rooms/${id}`, data),
  remove: (id: string) => api.delete(`/rooms/${id}`),
};

export const labsApi = {
  list: (params?: Record<string, unknown>) => api.get('/labs', { params }),
  create: (data: unknown) => api.post('/labs', data),
  update: (id: string, data: unknown) => api.patch(`/labs/${id}`, data),
  remove: (id: string) => api.delete(`/labs/${id}`),
};

export const sectionsApi = {
  list: (params?: Record<string, unknown>) => api.get('/sections', { params }),
  create: (data: unknown) => api.post('/sections', data),
  update: (id: string, data: unknown) => api.patch(`/sections/${id}`, data),
  remove: (id: string) => api.delete(`/sections/${id}`),
  autoCreateBatches: (id: string, batchSize?: number) => api.post(`/sections/${id}/auto-create-batches`, { batchSize }),
};

export const academicApi = {
  years: (params?: Record<string, unknown>) => api.get('/academic-years', { params }),
  semesters: (params?: Record<string, unknown>) => api.get('/semesters', { params }),
  days: () => api.get('/meta/days'),
  timeSlots: () => api.get('/meta/time-slots'),
  programs: (params?: Record<string, unknown>) => api.get('/meta/programs', { params }),
};

export const timetableApi = {
  list: (params?: Record<string, unknown>) => api.get('/timetables', { params }),
  get: (id: string) => api.get(`/timetables/${id}`),
  entries: (id: string) => api.get(`/timetables/${id}/entries`),
  updateEntry: (entryId: string, data: unknown) => api.patch(`/timetables/entries/${entryId}`, data),
  conflicts: (id: string) => api.get(`/timetables/${id}/conflicts`),
  publish: (id: string) => api.post(`/timetables/${id}/publish`),
  exportExcel: (id: string) => api.get(`/timetables/${id}/export/excel`, { responseType: 'blob' }),
  exportPdf: (id: string) => api.get(`/timetables/${id}/export/pdf`, { responseType: 'blob' }),
  viewFaculty: (facultyId: string) => api.get(`/timetables/views/faculty/${facultyId}`),
  viewSection: (sectionId: string) => api.get(`/timetables/views/section/${sectionId}`),
  viewRoom: (roomId: string) => api.get(`/timetables/views/room/${roomId}`),
  viewDepartment: (departmentId: string) => api.get(`/timetables/views/department/${departmentId}`),
};

export const schedulerApi = {
  generate: (data: unknown) => api.post('/scheduler/generate', data),
  status: (id: string) => api.get(`/scheduler/status/${id}`),
  optimize: (id: string) => api.post(`/scheduler/optimize/${id}`),
  resolveConflicts: (id: string) => api.post(`/scheduler/resolve-conflicts/${id}`),
};

export const notificationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAll: () => api.post('/notifications/read-all'),
};

export const constraintsApi = {
  list: () => api.get('/constraints'),
  create: (data: unknown) => api.post('/constraints', data),
  update: (id: string, data: unknown) => api.patch(`/constraints/${id}`, data),
};
