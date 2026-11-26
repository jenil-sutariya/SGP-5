# Login & Auth Pages Overrides

> **PROJECT:** SmartSched (CHARUSAT Timetable Portal)
> **Page Type:** Authentication Gateway (`LoginPage`, `ForgotPasswordPage`)

> Overrides `design-system/smartsched/MASTER.md` where specified below.

---

## Page-Specific Rules

### Layout Overrides
- **Layout:** Clean, centered responsive two-column architectural card on desktop (`max-w-4xl`) pairing institutional context (who uses the portal: Students, Professors, HODs, Timetable Officers) on the left with the focused Sign-In form on the right; single-column focused card on mobile (`max-w-md`).
- **Background:** Calm institutional gradient wash (`CharusatAnimatedBackground` architectural grid + soft navy/amber radial glow — zero floating text badges).

### Component Overrides
- **Password Input:** Must include a keyboard-accessible Show/Hide password toggle (`aria-label="Show password"` / `"Hide password"`).
- **Email Hint:** Clearly display `@charusat.edu.in` / `@charusat.ac.in` requirement.
- **Quick Demo Access:** Group demo sign-in presets cleanly under a clearly labeled "Demo Accounts" section with one-click fill so reviewers can test quickly without cluttering the primary sign-in flow.
- **Forgot Password:** Include clear back-navigation link to `/login` and proper `<Label htmlFor>` association.

