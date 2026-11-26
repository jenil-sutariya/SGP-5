# Dashboard Page Overrides

> **PROJECT:** SmartSched (CHARUSAT Timetable Portal)
> **Page Type:** Role-Aware Academic Overview (`DashboardPage`)

> Overrides `design-system/smartsched/MASTER.md` where specified below.

---

## Page-Specific Rules

### Layout Overrides
- **Max Width:** `max-w-7xl mx-auto`
- **Structure:**
  1. Role-aware Welcome Header + Scope selector (for University Admin) + Primary CTA (`View Timetable` for students/faculty, `Generate Timetable` for managers).
  2. 4-column KPI strip (`Total Timetables`, `Ready for Review`, `Published`, `Open Conflicts`) using unified semantic cards with `tabular-nums`.
  3. 2:1 Asymmetric Split: `Recent Timetables` list (2 cols) + `Timetable Status Breakdown` (1 col).
  4. `Academic Resources` quick-count strip (7-col grid on xl, responsive 2/3 cols on mobile/tablet) with clickable cards for authorized roles.
  5. `Next Steps / Quick Links` + `Unread Notifications` 2-column footer grid.

### Component Overrides
- Replace inconsistent `bg-white dark:bg-slate-900` ad-hoc panel classes with unified `surface-card` (`bg-card border border-border rounded-2xl shadow-xs`) so Dashboard visually matches Shell, Timetable, and Resource pages.
- Students and Professors see streamlined quick-links focused on viewing their schedule and notifications without admin-only setup clutter.

