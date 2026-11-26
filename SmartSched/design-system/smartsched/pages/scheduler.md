# Scheduler & Resource Pages Overrides

> **PROJECT:** SmartSched (CHARUSAT Timetable Portal)
> **Page Type:** AI Scheduler Workflow & CRUD Directory (`SchedulerPage`, `ResourcePage`, `SettingsPage`, `MasterAdminPage`)

> Overrides `design-system/smartsched/MASTER.md` where specified below.

---

## Page-Specific Rules

### Scheduler Page (`SchedulerPage`)
- **Structure:** Clear 2-column workflow on `lg:` (`Configuration Steps` left, `Live Generation Results & Conflicts` right).
- **Numbered Step Flow:** Group form controls into intuitive steps:
  1. `Timetable Name & Academic Period` (Year, Semester)
  2. `Target Scope` (Institute, Department, Division/Section)
  3. `Optimization Engine` (Genetic Algorithm toggle + clear explanation)
- **Results Panel:** Clear KPI badges (`Status`, `Entries`, `Conflicts`, `Score`), preserved-sessions explanation, scrollable unscheduled list, and action bar (`Schedule remaining`, `Check conflicts`, `Open Timetable`).

### Resource Directory Pages (`ResourcePage`)
- **Consistent Toolbar:** Header bar with title, subtitle, record count context, and primary `+ Add <Item>` button.
- **Filter Strip:** Search input + Department filter + custom filters aligned on a clean responsive flex row.
- **Data Table:** Crisp 1px-bordered table inside `surface-card`, sortable column headers with clear active sort icons, readable row padding (`py-3 px-4`), and accessible `Edit` / `Delete` action buttons.
- **Pagination:** Clear `Showing X to Y of Z` summary, accessible page controls, and items-per-page selector.

