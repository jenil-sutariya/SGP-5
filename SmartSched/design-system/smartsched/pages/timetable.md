# Timetable Page Overrides

> **PROJECT:** SmartSched (CHARUSAT Timetable Portal)
> **Page Type:** Core Scheduling Grid (`TimetablePage`, `ResourceTimetablePage`, `SessionEditor`)

> Overrides `design-system/smartsched/MASTER.md` where specified below.

---

## Page-Specific Rules

### Layout Overrides
- **Viewport Behavior:**
  - `One Window` (`isFitWindow`) fit-to-screen mode applies cleanly on desktop (`lg:`) viewports while automatically allowing natural scrolling on smaller viewports (`< 1024px`) so mobile/tablet users never see crushed unreadable cells.
- **Toolbar Hierarchy:**
  - **Row 1 (Primary Identity & View):** Title, active semester badge, mode indicator (Published / Weekly Template / Dated Week), Timetable selector, Division selector, Search input.
  - **Row 2 / Right Controls:** Week date picker (in dated mode), Fit/Scroll toggle (`lg:`), Export actions (Excel, PDF, Print), and role-gated Management actions (`Edit weekly template`, `Publish`, `Unpublish`, `Delete`) cleanly separated so students/faculty see a calm, uncluttered toolbar.

### Color & Contrast Overrides
- **Grid Header & Time Column:**
  - Light Mode: Subtle neutral header (`bg-slate-100 text-slate-800 border-b border-border`) and crisp time rail (`bg-slate-50 text-slate-900` with muted end time `text-slate-500`) — NEVER dark background with dark `text-foreground`.
  - Dark Mode: Deep slate header (`dark:bg-slate-900 dark:text-slate-100`) and time rail (`dark:bg-slate-900/90 dark:text-slate-100`).
- **Today Highlight:** Subtle primary tint (`bg-primary/8 text-primary dark:bg-primary/20 dark:text-blue-300`) with a static indicator dot (no distracting `animate-ping`).
- **Session Cards (`EntryCard`):**
  - **Theory Lecture:** Crisp blue-tinted surface (`bg-blue-50/90 border-blue-200 text-slate-900 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-slate-100`) with left accent bar (`border-l-4 border-l-primary`).
  - **Practical Lab:** Distinct warm amber-tinted surface (`bg-amber-50/90 border-amber-200 text-slate-900 dark:bg-amber-950/35 dark:border-amber-700/60 dark:text-slate-100`) with left accent bar (`border-l-4 border-l-amber-600`) and high-contrast Batch chip.
  - **Cancelled Session:** Clear red badge (`Cancelled · <reason>`) with icon, never color alone.

### Accessibility & Interaction
- In `Edit weekly template` mode, every session card exposes a visible, keyboard-focusable `Edit` action button in addition to drag-and-drop (WCAG 2.2 `Dragging Movements` compliance).
- `Unscheduled Sessions` drawer uses theme-aware `bg-card` surfaces (high contrast in both Light and Dark mode) with a clear close button.
- `SessionEditor` dialog uses semantic `surface-card` styling, labeled controls, and Escape-to-close support.

