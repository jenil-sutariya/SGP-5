# Design System Master File

> **LOGIC:** When building or updating a specific page, first check `design-system/smartsched/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** SmartSched (CHARUSAT Timetable Portal)
**Skill Source:** UI/UX Pro Max (`products.csv` #110 Calendar & Scheduling App, #185 Research Lab / University Department, #1 SaaS General; `ui-reasoning.csv` #1, #16, #110, #185; `styles.csv` Minimalism & Swiss Style + Soft UI Evolution; `ux-guidelines.csv`)
**Category:** University Academic Scheduling & Timetable Platform
**Audience:** Students, Professors (Faculty), HODs, Timetable Officers (Schedulers), Institute & University Admins
**Design Dials:** Variance 4/10 (Balanced / Structured) | Motion 3/10 (Subtle & Reduced-Motion Safe) | Density 7/10 (Crisp Operational Workspace)

---

## Global Rules

### Color Palette (Light-First Academic Authority + Full Dark Mode Parity)

#### Light Mode (`:root`)
| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Primary | `#0F3D82` | `--color-primary` | CHARUSAT Institutional Navy — primary CTAs, active nav, key headings |
| On Primary | `#FFFFFF` | `--color-primary-foreground` | Text/icons on primary fill (contrast > 9.5:1) |
| Primary Hover / Light | `#1D5BB8` | `--color-primary-light` | Hover states, secondary interactive blue |
| Secondary / Lab Accent | `#0E7490` | `--color-secondary` | Academic Teal — secondary accents, interactive tags |
| Gold / Practical Accent | `#B45309` | `--color-gold` | Academic Amber/Gold — lab/practical badges, highlights (WCAG AA on white) |
| Background | `#F8FAFC` | `--color-background` | Crisp page canvas |
| Foreground | `#0F172A` | `--color-foreground` | Primary body text & headings (contrast > 15:1) |
| Card / Surface | `#FFFFFF` | `--color-card` | Elevated panels, cards, table containers, modals |
| Subtle Surface | `#F1F5F9` | `--color-surface-subtle` | Table headers, secondary chips, search bar, inactive pills |
| Muted Text | `#475569` | `--color-muted` | Helper text, subtitles, table headers (contrast ~7:1 on white) |
| Border | `#E2E8F0` | `--color-border` | 1px architectural borders and row dividers |
| Success | `#047857` | `--color-success` | Published badges, conflict-free states |
| Warning | `#B45309` | `--color-warning` | Pending review, unscheduled warnings |
| Danger / Destructive | `#DC2626` | `--color-danger` | Errors, cancellations, destructive actions |

#### Dark Mode (`.dark`)
| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Background | `#0B1120` | `--color-background` | Deep Slate Navy canvas |
| Foreground | `#F8FAFC` | `--color-foreground` | Primary text (contrast > 14:1) |
| Card / Surface | `#111827` | `--color-card` | Distinct elevated card surface |
| Subtle Surface | `#1E293B` | `--color-surface-subtle` | Inputs, table headers, hover fills |
| Primary | `#2563EB` | `--color-primary` | Accessible action blue in dark mode |
| Primary Accent Text | `#60A5FA` | `--color-cyan-accent` | Links, active icons, subtle highlights on dark |
| Muted Text | `#94A3B8` | `--color-muted` | Secondary labels (contrast > 5.5:1 on `#111827`) |
| Border | `#1E293B` | `--color-border` | Neutral slate borders (no neon outlines) |

**Color Rules:**
- Never convey state by color alone — pair status colors with clear text labels and icons (e.g., `Published`, `Cancelled`, `Lab`, `Locked`).
- Maintain `>= 4.5:1` contrast for normal text and `>= 3:1` for UI borders and icons in both Light and Dark modes.
- Never apply dark background utilities (e.g., `bg-slate-900`) without matching light-mode surfaces and legible foregrounds.

---

### Typography

- **Display / Headings:** `Plus Jakarta Sans`, sans-serif (`font-display`, weights 600, 700, 800, `letter-spacing: -0.02em`)
- **Body / Controls:** `Inter`, sans-serif (`font-sans`, weights 400, 500, 600, `line-height: 1.5`)
- **Numeric / Time / Codes:** `JetBrains Mono` / `ui-monospace` with `font-variant-numeric: tabular-nums` for period times, room codes, counts, and elapsed timers.

**Scale:**
- Page Title (`h1`): `text-2xl sm:text-3xl font-bold tracking-tight`
- Section Title (`h2`): `text-lg font-semibold tracking-tight`
- Card / Sub-header (`h3`): `text-base font-semibold`
- Body: `text-sm` (14px) / `text-base` (16px) for long-form descriptions
- Meta / Micro-label: `text-xs` (12px, never smaller than 11px for essential labels)

---

### Spacing & Elevation Rhythm

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` (`0.25rem`) | Compact inline badge gaps |
| `--space-sm` | `8px` (`0.5rem`) | Icon-to-text gaps, dense grid cell gaps |
| `--space-md` | `16px` (`1rem`) | Standard card padding on mobile, form field gaps |
| `--space-lg` | `24px` (`1.5rem`) | Standard desktop card padding, section vertical rhythm |
| `--space-xl` | `32px` (`2rem`) | Major page block separation |

**Elevation & Borders:**
- **Surface Card:** `rounded-2xl border border-border bg-card shadow-xs` (crisp 1px edge, subtle lift, high readability — avoid heavy blur over text-dense data).
- **Sticky Header / Shell:** Subtle translucent surface (`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-border shadow-sm`).
- **Interactive Card Hover:** `transition-colors duration-200 hover:border-primary/35` — never shift layout bounds with aggressive scale transforms on tables or dense cards.

---

## Component Specs

### Buttons
- Minimum interactive height: `h-10` (40px) default, `h-9` (36px) compact toolbar actions, `h-11` (44px) primary form CTAs.
- Always include `cursor-pointer`, `transition-colors duration-150`, and `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
- Icon-only buttons MUST include an explicit `aria-label`.

### Form Inputs & Selects
- Consistent `h-10` (or `h-11` on auth/primary forms), `rounded-xl`, `border border-border`, `bg-white dark:bg-slate-900`, `text-sm text-foreground`.
- Every input and select MUST have a visible `<Label htmlFor="...">` or `aria-label` (never placeholder-only).
- Inline validation errors sit directly below the field with `role="alert"` / `aria-describedby`.

### Data Tables & Lists
- Semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`.
- Sticky or tinted `bg-surface-subtle` header row with `text-xs font-semibold uppercase tracking-wider text-muted`.
- Always wrap wide tables in `overflow-x-auto` so mobile viewports never horizontally overflow the page.

### Modals & Dialogs
- Use `role="dialog" aria-modal="true" aria-labelledby="..."`, Escape-key dismissal, backdrop click dismissal, and visible close button (`aria-label="Close"`).

---

## Anti-Patterns (Do NOT Use)

- ❌ **Floating background badges/icons behind dense data** — creates visual noise and lowers legibility.
- ❌ **Neon cyan outlines (`rgba(56,189,248,0.2)`) on every border in dark mode** — use clean neutral slate borders.
- ❌ **Hardcoded dark colors inside light-mode timetable cells or drawers** — always ensure both themes have >= 4.5:1 text contrast.
- ❌ **Emojis as structural icons** — always use `lucide-react` vector icons with `aria-hidden="true"` when paired with text.
- ❌ **Unbounded `animate-pulse` / `animate-ping` / `animate-bounce` on decorative UI** — reserve motion for loading indicators and purposeful micro-feedback; honor `prefers-reduced-motion`.
- ❌ **Pointer-only drag-and-drop without button/dialog alternative** — always keep a clear button/keyboard path to edit/move sessions.

---

## Pre-Delivery Checklist

- [ ] No emojis used as structural icons (SVG via `lucide-react`)
- [ ] `cursor-pointer` and `focus-visible` ring on all clickable controls
- [ ] Light and Dark mode text contrast >= 4.5:1 across every page and timetable cell
- [ ] All form controls have accessible labels
- [ ] `prefers-reduced-motion` respected globally
- [ ] Responsive behavior verified across mobile (`375px`), tablet (`768px`), and desktop (`1280px+`) without horizontal page overflow
- [ ] Role-appropriate simplicity: students/faculty are not overwhelmed by admin clutter

