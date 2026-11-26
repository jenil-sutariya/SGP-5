# Timetable hardening implementation and rollout

13 October 2026. The full plan is in [TIMETABLE-HARDENING-PLAN.md](TIMETABLE-HARDENING-PLAN.md).

## Implemented behavior

1. **Ownership and visibility.** Every timetable route now uses a central access policy, including entries, sessions, views, exports, conflicts, generation, optimization and status. Timetables have explicit institute ownership. Department heads manage their department; faculty read their teaching. Students see only their published division/practical-batch entries. Students without a practical-batch assignment see division-wide teaching only. Foreign or unpublished IDs cannot be recovered through exports or saved browser selections. Dashboard timetable data follows the same policy. Faculty user projections omit password hashes. Browser query caches clear when accounts change.
2. **Academic changes.** PostgreSQL takes the same scheduling lock as the application and validates the final state of relevant transactions. It rejects changes that invalidate active teaching: capacity/equipment/type, faculty availability/preferences/load/assignments, inactive resources, institute ownership, subject/session requirements, section/batch membership, semester/year dates and published teaching completeness. Conflicting changes return HTTP 409 and roll back. Cosmetic edits and login timestamps avoid rebuilding reservations. Practical-batch rebuilding preserves existing IDs and refuses removal of referenced batches.
3. **Reservations.** Generated and published entries reserve actual semester dates and clock intervals. PostgreSQL exclusion constraints cover classrooms, laboratories, faculty and student audiences across all timetables. Adjacent periods and separate practical batches with separate resources are allowed. Whole-division teaching conflicts with every practical batch. Triggers also protect ordinary SQL changes; direct reservation/validation-queue writes and scheduling-table TRUNCATE are rejected. Unpublish retains reservations; archive/delete releases them.
4. **Calendar and venue requirements.** Institute/global holidays and approved faculty leave cancel individual dated occurrences. Pending/rejected leave does not cancel teaching. Recurring holidays match month/day. Timetable and room/lab pages show a dated week and cancellation reasons. Staff can switch to the weekly template. Settings contains holiday management; subjects expose required equipment, minimum capacity and room type; laboratories have a room-type selector. Leave endpoints enforce ownership and forbid self-approval. Greedy and genetic scheduling respect venue requirements and reject weekdays with no surviving teaching occurrence for the assigned faculty.
5. **Whole sessions.** Generated/backfilled entries share a stable session ID. Session APIs create, move, change teacher/venue, lock/unlock or delete the entire consecutive block atomically. Breaks, collisions, incomplete blocks and locked moves are rejected. Single-entry APIs cannot split a lab. The timetable's weekly-template editor and drag/drop use these session APIs. Published timetables must be unpublished before editing.
6. **Published-only students.** This was explicitly selected by the user. List/detail, section views, exports, occurrences and dashboard summaries enforce it on the server. Student date views refresh periodically; a failed read after unpublication clears the visible occurrences.

## Database rollout status

**Applied to the working database on 13 October 2026 after explicit user approval.** The DEPSTAR CSE timetable `cmv1zmwri0003fvgsu17bhpn4` was archived in the same transaction as the hardening migration. Database protections are active, Prisma Client was regenerated, and the existing backend watcher restarted the API successfully.

Before rollout, the database had no Prisma migration history and its schema was verified to match the pre-hardening Prisma schema exactly. The first three migrations were recorded as already applied without executing historical CREATE TABLE statements. The hardening migration then added ownership, sessions, lab types, reservation indexes/table, guarded triggers, checks and backfills inside one transaction. All four migrations are now recorded; `prisma migrate status` reports the database schema up to date.

The original data failed the new exclusion constraint because one DEPSTAR CSE timetable contained 28 overlapping laboratory entry pairs. See [TIMETABLE-LEGACY-PREFLIGHT.md](TIMETABLE-LEGACY-PREFLIGHT.md) for the preserved historical snapshot. Archiving only `cmv1zmwri0003fvgsu17bhpn4` was tested on a full database copy before the user approved the working-database change. The applied result was verified:

- 6 timetable headers retained: 1 archived, 5 generated.
- All 935 saved periods retained, including the archived timetable's 352 periods.
- 583 periods remain active, producing 39,921 dated resource reservations.
- Every original entry value is unchanged, verified by a before/after fingerprint excluding the newly added session ID. All timetable owners and session IDs were backfilled.
- The exclusion constraint is present and deferred. The archived timetable has zero reservations.
- The current read-only audit reports zero overlapping active weekly entry pairs; see [TIMETABLE-DATABASE-AUDIT.md](TIMETABLE-DATABASE-AUDIT.md).

No entries were deleted or regenerated. Staff can inspect archived teaching and generate missing teaching again while preserving the other active timetables. There are currently no published timetables, so student timetable lists are empty until staff publishes a valid timetable.

The pre-migration PostgreSQL custom-format backup is retained locally at `.backups/timetable-hardening-20261013-p5B7kE/smartsched-before-hardening.dump` (772,163 bytes; SHA-256 `592fc0ce703bf13d1fd131c5a8083a4ed0ed1d543faf376c49274ca15857f8d1`). The directory is ignored by Git and also contains the approved SQL, preflight fingerprint and verification results. `pg_restore --list` read the backup successfully. The application worker was stopped during backup/migration; no database reset was used.

## Deployment procedure used

1. Back up the database and verify the target connection. Stop writes during the migration. Confirm that the preflight still identifies the same conflicting timetable; repeat the audit if data changed.
2. For an existing schema-pushed database **only after confirming the schema matches the pre-hardening baseline**, record these migrations as already applied with `prisma migrate resolve --applied <name>`: `20250301000000_init`, `20250716000000_institutes`, `20261013000000_schema_alignment`. Do not execute historical CREATE TABLE migrations against populated tables.
3. Apply the approved archival and `20261013010000_timetable_hardening/migration.sql` in one transaction. The migration already contains BEGIN/COMMIT; insert the explicit approved status update immediately after BEGIN when preparing the deployment script. Any backfill/validation failure must roll back both actions. Record this migration as applied only after commit. Do not reset the database or discard entries to make the migration pass.
4. Regenerate Prisma Client, restart the backend, and verify ownership/session backfills, active reservation counts, student publication access and representative protected edits. This is complete for the working database.
5. For a fresh database, ordinary `prisma migrate deploy` applies the full migration chain; no baseline or archival is needed.

Use `scripts/local-db.cjs` for credential-safe local psql calls (`PSQL_PATH` can override the binary). `npm run audit:timetables` is read-only and writes the current report to `TIMETABLE-DATABASE-AUDIT.md`, preserving the historical migration preflight. The database/API test scripts deliberately use **only** `smartsched_hardening_test`; never point fixture writes at the working database. The matching SQL in `prisma/timetable-guards.sql` is included in the versioned migration; do not edit a deployed migration later—add a new one.

## Verification

Working-database deployment checks:

- API health, administrator timetable list (including the archive), and dated occurrences succeeded after restart.
- An assigned student received an empty timetable list and HTTP 404 for generated/archived timetable IDs. An institute administrator received HTTP 404 for another institute's timetable.
- A capacity increase passed deferred validation and was rolled back deliberately. A conflicting capacity reduction was rejected; its original value remained unchanged.
- Direct reservation deletion was rejected. All 39,921 reservations remained intact.
- The backup, migration history, entry fingerprint, status/counts, backfills and exclusion constraint were checked against the approved preflight.

Implementation verification completed before deployment:

- Prisma schema validation and client generation passed. A running backend worker held the generated DLL; it was restarted through its existing watcher to complete generation.
- Backend TypeScript/build and frontend production build passed. Vite still reports its existing large-bundle/dynamic-import warnings.
- Database integration: 30 checks, including direct SQL overlap across different slot IDs, concurrent writes, whole-division/batch collision, equipment/type/capacity, availability/load, assignment removal, duration changes, dated exception refresh, archival, queue/reservation bypass attempts and whole-session moves.
- Authenticated API integration: 54 checks covering foreign institute IDs across endpoint families, scoped admins/faculty/students, publication/export restrictions, session movement/locking/deletion, transactional capacity rejection and dated holidays.
- Backend unit tests: 73 passed across 11 suites. Frontend timeline tests: 4 passed. Together with the database and API integration suites, 161 automated checks passed.
- Chrome smoke tests passed against the isolated database: dated timetable, two-period session editor and save, holiday settings, dated lab view and a 390px mobile timetable. Screenshots were visually inspected; no browser runtime exceptions were observed.
- Full migration chain tested on a fresh isolated database. Original-data failure and archival success tested on a full working-database copy. A representative capacity increase plus full deferred validation took approximately 1 second on that copy, with the test transaction rolled back. No production/load-scale benchmark is implied.

## Re-running the integration suites

Create a fresh local PostgreSQL database named `smartsched_hardening_test`. Apply all four SQL migration files in their timestamp order to that database (including alignment and hardening), then from `backend` run:

```text
npm run test:timetable-db
npm run test:timetable-api
```

The database suite creates its isolated fixtures. Test scripts replace only the database name in the configured connection URL; use a local test server/account. They never reset or seed the working application database. Temporary test databases, browser profile, test copies and browser helpers were removed after implementation verification. The approved rollout backup remains at the location recorded above.

## Practical limits

The generator still plans recurring weekly templates and conservatively reserves saved weekly bookings; it does not use a one-day holiday to insert a different recurring class. Date views and database reservations apply exact cancellations. Automatic make-up teaching or substitute-faculty assignment is not implemented.

This protects ordinary application/SQL writes, not a database owner deliberately disabling triggers or dropping constraints. Keep the application role separate from migration/owner privileges in deployment. Prisma does not model exclusion constraints in its schema; preserve their custom SQL in future migrations. PostgreSQL documents [range exclusion constraints](https://www.postgresql.org/docs/17/rangetypes.html); Prisma documents [custom migration SQL for unsupported database features](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/unsupported-database-features).
