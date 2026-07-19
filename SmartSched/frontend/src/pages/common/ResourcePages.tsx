/**
 * ResourcePages barrel — re-exports all resource page components from their
 * individual module files. Also re-exports shared utility pages so the router
 * has a single import location.
 */

// Resource pages (CRUD pages for each data domain)
export * from './resources/InstitutesPage';
export * from './resources/BatchesPage';
export * from './resources/DepartmentsPage';
export * from './resources/FacultyPage';
export * from './resources/StudentsPage';
export * from './resources/CoursesPage';
export * from './resources/SubjectsPage';
export * from './resources/RoomsPage';
export * from './resources/LabsPage';
export * from './resources/NotificationsPage';
export * from './resources/SectionsPage';
