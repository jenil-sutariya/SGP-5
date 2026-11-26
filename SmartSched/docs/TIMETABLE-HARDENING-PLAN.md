# Timetable hardening plan

Prepared 13 October 2026. Scope: the six requested safeguards, including API, scheduling, database migration, staff/student UI, and regression verification. Existing generated and published teaching must be preserved. No automatic deletion or rescheduling of saved teaching is permitted.

## Decisions

- Students see only PUBLISHED timetables for their own division/practical batch. Staff preview remains available within their authorized institute; department heads manage their department, faculty read their own teaching. The user explicitly confirmed published-only for students.
- An academic/resource edit is saved atomically only if affected active timetables remain valid. Return specific conflicts when rejecting an edit. Publishing still requires complete teaching.
- Weekly entries are recurring templates. Holidays and APPROVED faculty leave cancel the affected dated occurrences; they do not remove that weekday for the whole semester. Date views show cancellation reasons. Pending/rejected leave has no scheduling effect.
- Every multi-period teaching session has a stable session ID. Moves, teacher/venue changes, locking and deletion operate on the whole session. Single-entry endpoints must not split a multi-period session.
- Database reservations cover actual teaching dates and clock intervals. GENERATED and PUBLISHED reserve resources. Unpublish retains reservations; archive/delete releases them. Adjacent periods are allowed. Different practical batches may run in parallel, but a whole-division class overlaps every batch.
- Migration must backfill ownership and sessions, report ambiguous/invalid legacy data, and fail without deleting data. Triggers maintain reservations even for ordinary direct SQL writes. Database owners who disable constraints/triggers are outside this protection.

## Execution order and acceptance checks

1. **Central authorization and explicit ownership**
   - Add explicit timetable institute ownership with a safe legacy backfill.
   - Centralize read/manage policy and enforce it for list/detail, entries, all resource/faculty/section/department views, exports, conflicts, publication/deletion, generation/status/optimization, and session actions.
   - Fail closed for accounts with missing institute/department/student/faculty scope. Validate referenced IDs and prevent request-body scope changes from bypassing access.
   - Filter student entries and exports, not only timetable headers. Use safe faculty user projections.
   - Tests: global/scoped admins, heads, faculty, students, forged filters, unowned records, foreign entry IDs, export and scheduler routes.

2. **Shared validation and protected academic edits**
   - Enforce the shared scheduling lock in PostgreSQL for every relevant academic/resource write. A protected deferred-validation queue validates the final transaction state, including direct SQL. Session and batch operations additionally use the application transaction helper.
   - Validate active timetables after the proposed change, rolling back incompatible changes. Include institute ownership, active records, capacity, venue requirements, faculty assignment/availability/load, period continuity and published teaching completeness.
   - Preserve identities of practical batches when rebuilding them; refuse destructive replacement of referenced batches.
   - Tests: safe capacity increases succeed; capacity reductions, unavailable teaching, reassignment and altered teaching counts fail atomically when incompatible.

3. **Dated occurrences and venue eligibility**
   - Normalize equipment names; every configured equipment requirement and minimum capacity is mandatory. Room type must match the subject requirement; labs have an explicit room type.
   - Apply the same eligibility rules in greedy/genetic generation, manual edits and publication/conflict checks.
   - Add scoped holiday management and enforce approved leave in occurrence/reservation generation. Provide a dated week view with holiday/leave cancellation labels.
   - Tests: holidays, recurring holidays, institute-specific dates, inclusive leave dates, pending leave, missing equipment, room type and capacity.

4. **Database reservations and migration**
   - Add a reservation table maintained by triggers on entries, timetable status/date scope, calendar and dated exceptions.
   - Add PostgreSQL exclusion constraints for room/lab/faculty and student audience intervals. Whole-section ranges conflict with any batch; separate batch ranges remain independent.
   - Backfill existing active entries. Add migration preflight and test the SQL on an isolated database/schema before applying it to the local development database when available.
   - Tests: raw SQL and concurrent overlapping inserts fail, adjacent/nonoverlapping dates succeed, publish/unpublish/archive/delete and holiday/leave changes refresh reservations.

5. **Atomic session editing**
   - Generate/backfill session IDs and add validated session create/update/delete endpoints.
   - Preserve all periods and validate consecutive non-break slots, one teacher/venue/cohort, locks, ownership and conflicts in one transaction.
   - Update drag/drop and editing UI to move/delete the complete session and clearly show its duration.
   - Tests: a two-period lab moves together, conflicts/locked sessions roll back, and single-entry endpoints cannot split it.

6. **Student visibility, UI and final verification**
   - Enforce PUBLISHED in all student paths including exports, saved IDs, scheduler status and dashboard shortcuts; unpublish removes student access immediately.
   - Add staff-facing explanation of rejected changes, venue requirement controls and dated cancellations; keep database implementation details out of normal UI.
   - Run Prisma validation/generation, backend tests/build, frontend tests/build, database integration checks, and browser smoke tests where available.
   - Update the generation audit and this plan with actual results and any remaining rollout limitations.

## Rollout and validation status

- Implementation: complete in the working tree. Final verification results and deployment steps are recorded in `TIMETABLE-HARDENING-ROLLOUT.md`.
- Database migration: applied to the working database on 13 October 2026 after the user approved archiving the conflicting DEPSTAR CSE timetable. All 935 saved periods were retained; five generated timetables with 583 periods remain active. All four migrations are recorded and Prisma reports the schema up to date. See `TIMETABLE-HARDENING-ROLLOUT.md`.
- Verification: backend and frontend builds, database and authenticated API integration checks, unit tests, and Chrome desktop/mobile smoke testing have been run. See rollout notes for exact counts and limitations.
- Existing unrelated workspace edits will be preserved.
