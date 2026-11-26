# Current timetable database audit

Read-only snapshot taken 2026-10-13T16:04:26.600Z. No working-database records were changed by this audit. The original migration preflight and its approved resolution remain in [TIMETABLE-LEGACY-PREFLIGHT.md](TIMETABLE-LEGACY-PREFLIGHT.md).

6 timetables; 935 saved periods; 0 overlapping weekly entry pairs across overlapping semester dates. These are entry pairs, not a count of affected students or distinct calendar dates.

| ID | Institute | Department | Semester | Status | Periods |
| --- | --- | --- | --- | --- | --- |
| cmv1zmwri0003fvgsu17bhpn4 | DEPSTAR | CSE | Odd Semester 2025-26 | ARCHIVED | 352 |
| cmv2peqjq0003fvkkg381xk3a | DEPSTAR | IT | Odd Semester 2025-26 | GENERATED | 48 |
| cmv2pjman001hfvkkcijqyvx2 | DEPSTAR | IT | Odd Semester 2025-26 | GENERATED | 48 |
| cmv2pynjd0003fvi4u9auvmq1 | DEPSTAR | IT | Odd Semester 2025-26 | GENERATED | 48 |
| cmv2q1qdc001hfvi4xrr3v86c | DEPSTAR | Institute-wide | Odd Semester 2025-26 | GENERATED | 391 |
| cmv2r3ask0001fvp40fhwh8zv | CSPIT | CIVIL | Odd Semester 2025-26 | GENERATED | 48 |

## Active timetable review

No overlapping active weekly entry pairs were detected. Archived and draft timetables are excluded from active conflict checks; their saved periods remain included in the table above. This audit does not archive, delete or regenerate teaching.

## Conflicting entry pairs

| Timetable | Entry A | Entry B | Day | Time | Venue | Conflict |
| --- | --- | --- | --- | --- | --- | --- |


The SQL pair audit is conservative about dated holidays/leave. Database reservations and exclusion constraints enforce conflicts on actual teaching dates.
