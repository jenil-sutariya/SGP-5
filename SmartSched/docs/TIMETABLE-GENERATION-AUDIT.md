# Timetable generation audit and booking rules

Reviewed on 10 October 2026. This is a source-code audit of the scheduling workflow and the project modules that supply it: Prisma models, academic data, faculty assignments/availability, rooms/labs, API access, timetable editing/publication, analytics and frontend actions. It is not a claim that every application feature has been exercised against the live database.

## Required behaviour: DEPSTAR CSE followed by DEPSTAR IT

If CSE books DEPSTAR room D101, lab DL1 or professor F1 on Monday 09:00–10:00, later IT generation must treat each booked resource as unavailable during that interval. These resources can still be used at other free times. An existing practical batch booking blocks a lecture for its whole division, while different practical batches may run in parallel with different faculty and venues.

CSPIT rooms/labs remain separate from DEPSTAR. The same physical resource must have one database ID; duplicate resource records defeat any ID-based booking system.

## Implemented in this change

| Finding | Correction |
| --- | --- |
| Engine occupancy was reset to empty for each generation. | Load entries from all GENERATED and PUBLISHED timetables whose semester dates overlap the requested semester; seed them into every greedy/genetic run. |
| Old generated timetables were deleted before scheduling succeeded. | Preserve all saved entries. Schedule only missing offering/batch sessions; append to a GENERATED timetable with matching scope when available. Otherwise create a supplemental timetable. Fully scheduled scopes return a clear message without creating another timetable. |
| Time-slot IDs were used as the only collision boundary. | Project saved start/end times onto the new calendar and compare actual overlapping intervals. Adjacent periods do not clash. Overlapping period definitions in the selected calendar are rejected. |
| Old faculty work was omitted from workload limits. | Include existing teaching hours in daily and weekly totals, using period durations. |
| Laboratory sharing was allowed whenever capacity remained. | Make each lab exclusive during a booked interval, as requested. Capacity still determines whether a batch fits. |
| Availability with no permitted slots became unrestricted; UNAVAILABLE could be only a score penalty. | Explicit unavailable periods are blocked, including day-only and period-only preferences. An empty allowed set allows no teaching. Unspecified periods remain available. |
| Faculty could be silently invented/substituted. | Require existing faculty assignments and active academic records. Batches sharing one assigned teacher run sequentially if they cannot run in parallel. |
| Independent generation requests could choose the same free slots. | Take the planning snapshot and save under a PostgreSQL transaction advisory lock, releasing the transaction during calculation. Re-read and compare all planning inputs before saving; stale plans return a retry message. Inserts, conflict checks and status updates commit together or roll back. |
| Duplicate inserts were silently discarded. | Remove skipDuplicates and silent filtering. Unexpected duplicates fail the transaction. |
| Conflict detection only inspected one timetable. | Compare the target timetable with active bookings across overlapping semesters, covering rooms, exclusive labs, faculty, divisions, batches, workload and multi-period continuity. |
| Manual edits could introduce clashes; moving a lab deleted its other periods. | Validate within the same transaction and roll back conflicting edits. Remove automatic deletion of the other lab period. Reject edits that leave incomplete multi-period blocks. Published entries require unpublishing before editing. |
| Publish did not check missing teaching or actual conflicts. | Check required offering/batch period counts against saved entries and reject incomplete/conflicting publication. |
| Resolve Conflicts could delete lectures, including another timetable's entries. | Make this action a conflict report. UI says Check conflicts; no teaching is deleted. |
| Re-Optimize misleadingly rebuilt from scratch. | UI says Schedule remaining. It preserves existing allocations and attempts only missing sessions. |

## Status and regeneration rules

- GENERATED and PUBLISHED entries reserve resources. Unpublishing returns to GENERATED, so its bookings remain reserved.
- DRAFT and ARCHIVED timetables do not reserve resources for automatic generation. Deleting a timetable also releases its bookings.
- Existing generated/published entries are preserved regardless of isLocked. isLocked still prevents manual changes to that entry.
- A failed attempt commits no new entries or header and does not erase earlier work.
- A partially successful attempt stores the feasible sessions and lists the remainder. No conflict-free schedule can be guaranteed to exist when demand exceeds available rooms, labs, faculty hours or periods.
- Supplementary timetables can exist for a scope first generated with an older schema/metadata shape or a different division scope. The booking baseline includes them all.
- Existing conflicting data is not automatically moved or deleted. Use Check conflicts on affected timetables, then repair the underlying allocation.

## Remaining improvements, in priority order

1. **Enforce ownership on every API read/write.** `timetable.routes.ts` and scheduler status/optimization endpoints still have ID-based paths without comprehensive institute/department ownership checks. `utils/instituteScope.ts` permits fallback to caller-supplied scope when a non-admin has no institute. Make missing scope fail closed and check the actual target timetable/entry. Test student, faculty, head, scheduler, institute admin and global admin access separately.
2. **Protect changes to referenced academic data.** Room/lab capacity, building ownership, faculty availability, teaching limits, offerings and semester dates can be changed through other services. Those writes do not yet acquire the scheduling lock or revalidate affected timetables. Either reject incompatible edits while active bookings exist or atomically revalidate and mark affected timetables for review.
3. **Add database-backed resource reservations.** Current unique keys in `schema.prisma` include timetableId and cannot independently prevent cross-timetable clashes. A normalized reservation table with an active flag and date/time interval constraints would protect against scripts and code paths bypassing application validation. Include room, lab, faculty and whole-section versus practical-batch rules. Apply through a reviewed migration after auditing existing data.
4. **Separate publication from visibility.** Faculty/section/room views currently include both GENERATED and PUBLISHED timetables. Define GENERATED as staff preview and PUBLISHED as the student/faculty official view, if that is the intended workflow. Unpublish currently changes status and keeps reservations; it does not hide a timetable everywhere.
5. **Model teaching requirements in minutes.** Workload now uses actual period duration, but subject weeklyHours/labHours are still expanded into period counts. PRACTICAL uses one or two periods and LAB currently creates one block per batch. For different period lengths or multiple lab sessions per week, store session count and session duration explicitly and use the same requirement expansion for generation and publication.
6. **Replace hard-coded calendar/sharing rules.** Lab starts remain limited to period orders 1, 4 and 7; CSE/IT/CE sharing is hard-coded. Day name/order and TimeSlot order are globally unique despite optional instituteId. Move calendars, permitted lab starts and department sharing to validated institute settings with scoped uniqueness.
7. **Respect equipment, room types and dated exceptions.** Subject requirements, full configurable hard constraints, holidays and approved leave are not comprehensively enforced by the scheduler. Weekly availability cannot represent a one-day leave accurately. Add dated exceptions/substitutions and equipment/room-type eligibility before treating generation as production-ready.
8. **Provide an atomic whole-session editor.** A lab consists of multiple entry rows. The current single-row drag/drop will reject moves that split a block. Add a sessionId and a move/delete operation covering the entire block under one transaction; keep all periods, teacher, room/lab and batch consistent.
9. **Improve diagnostics and throughput.** Show why each session was unassigned (teacher busy, no suitable lab, capacity, daily limit, etc.). Planning now runs outside database transactions, with a snapshot fingerprint and a locked validation/commit step. The calculation still runs synchronously on the API process; move it to a worker/job so large runs do not block other requests. Optimize conflict lookup by resource and interval rather than pairwise scanning for large campuses.
10. **Define regeneration and version history explicitly.** Add Continue missing sessions, Replace selected scope, Archive, and Preview changes as distinct operations. Replacement must preserve locked sessions and other departments, show which allocations will change, and swap versions atomically. The current safe operation only adds missing teaching.

## Validation and limits

### Transaction timeout correction — 13 October 2026

Generation previously kept its interactive transaction open during the greedy/genetic calculation. A reported run spent 158,786 ms against a 120,000 ms transaction limit, then failed at the first database query after calculation. The read/prepare transaction now completes before calculation begins. A fresh transaction reacquires the scheduling lock, re-reads the academic settings and active bookings, and rejects a changed snapshot before inserting anything. The existing transaction timeout was not increased.

Regression tests simulate calculations longer than two minutes and verify they run without an open transaction. They also cover bookings, capacity, availability, workload or teaching requirements changing before save, a concurrent request completing the same scope, and failure to reacquire the save lock. These are mocked tests; live database performance and concurrency still require separate verification.

Regression coverage includes CSE then IT, same-faculty bookings, shared rooms, exclusive labs, clock-time overlaps with different slot IDs, adjacent free periods, saved workload, empty availability, genetic preservation, duplicate generation, partial continuation, transaction-lock rejection, publication completeness and existing institute separation.

Run the targeted tests with:

```
cd SmartSched/backend
npx jest --runInBand scheduler-bookings scheduler-generation scheduler-snapshot cross-timetable-conflicts timetable-completeness timetable-institute institute-scheduling dashboard
npm run typecheck
```

Database interactions in these tests are mocked. A real PostgreSQL concurrency test, authenticated browser workflows and an audit of existing live timetable rows are still required. No production/seed data was rewritten by this audit. Treat the application lock as protection for the participating application paths, not a substitute for database constraints or a guarantee about all future edits.


## 13 October 2026 hardening follow-up

The six requested safeguards are implemented, and the database migration was applied on 13 October 2026. See [the full plan](TIMETABLE-HARDENING-PLAN.md) and [implementation, verification and rollout notes](TIMETABLE-HARDENING-ROLLOUT.md). Students were explicitly set to published-only visibility. With the user's approval, the DEPSTAR CSE timetable containing 28 internal laboratory overlaps was archived; all 352 periods were retained. Five generated timetables with 583 periods remain active, protected by 39,921 dated reservations. All 935 saved periods were preserved. [Historical preflight and resolution](TIMETABLE-LEGACY-PREFLIGHT.md). The earlier remaining-improvements and validation sections describe the original audit; the rollout notes supersede them for the six completed safeguards.
