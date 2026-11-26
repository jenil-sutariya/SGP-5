# Existing timetable migration preflight

Historical read-only snapshot taken 13 October 2026, before migration. The table and conflict pairs below preserve the original state; they do not describe the current active timetables.

**Resolution applied on 13 October 2026 with explicit user approval:** timetable `cmv1zmwri0003fvgsu17bhpn4` was archived in the same transaction as the hardening migration. All 352 of its periods remain saved. The other five timetables retain their 583 active periods. All 935 original entry records were verified unchanged apart from the added session IDs. See [rollout verification](TIMETABLE-HARDENING-ROLLOUT.md). Future read-only audits write to `TIMETABLE-DATABASE-AUDIT.md` and preserve this snapshot.

6 timetables; 935 saved periods; 28 overlapping weekly entry pairs across overlapping semester dates. These are entry pairs, not a count of affected students or distinct calendar dates.

| ID | Institute | Department | Semester | Status | Periods |
| --- | --- | --- | --- | --- | --- |
| cmv1zmwri0003fvgsu17bhpn4 | DEPSTAR | CSE | Odd Semester 2025-26 | GENERATED | 352 |
| cmv2peqjq0003fvkkg381xk3a | DEPSTAR | IT | Odd Semester 2025-26 | GENERATED | 48 |
| cmv2pjman001hfvkkcijqyvx2 | DEPSTAR | IT | Odd Semester 2025-26 | GENERATED | 48 |
| cmv2pynjd0003fvi4u9auvmq1 | DEPSTAR | IT | Odd Semester 2025-26 | GENERATED | 48 |
| cmv2q1qdc001hfvi4xrr3v86c | DEPSTAR | Institute-wide | Odd Semester 2025-26 | GENERATED | 391 |
| cmv2r3ask0001fvp40fhwh8zv | CSPIT | CIVIL | Odd Semester 2025-26 | GENERATED | 48 |

## Approved repair

All 28 detected pairs belong to `cmv1zmwri0003fvgsu17bhpn4` (DEPSTAR CSE, 352 periods). The migration was tested against a full copy of the working database: unchanged data correctly rejected the reservation constraint; archiving only this timetable allowed the migration to complete. Archiving retains its header, entries and sessions for inspection, and releases its active reservations. The other five timetables and their 583 periods remain active.

This repair was approved and applied to the working database. Missing teaching may now be generated again using the retained active timetables as bookings. No automatic deletion or regeneration was performed.

## Conflicting entry pairs

| Timetable | Entry A | Entry B | Day | Time | Venue | Conflict |
| --- | --- | --- | --- | --- | --- | --- |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr3660008fvgs348sefn3 | cmv1zr36a0095fvgsnavh0co8 | MONDAY | 09:10–10:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000ofvgsczkbvtys | cmv1zr3670012fvgsv5j46yfh | MONDAY | 09:10–10:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003mfvgsuf53loxz | cmv1zr368003ofvgsn2obppwp | MONDAY | 09:10–10:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr3660009fvgstmbz3uge | cmv1zr36a0096fvgsan38p4nv | MONDAY | 10:10–11:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000pfvgs3c7q4yi3 | cmv1zr3670013fvgsy66ienf6 | MONDAY | 10:10–11:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003nfvgsryls3kyz | cmv1zr368003pfvgs7k6p6zl2 | MONDAY | 10:10–11:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000cfvgs1l87vtx7 | cmv1zr36a0097fvgsezlxcafi | TUESDAY | 09:10–10:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000ufvgsfm3wzv41 | cmv1zr3670018fvgsfhbdn65f | TUESDAY | 09:10–10:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003qfvgscvvf7s8y | cmv1zr36a0099fvgs1h9jjch0 | TUESDAY | 09:10–10:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000dfvgs8aau0w3m | cmv1zr36a0098fvgsblhgsrmd | TUESDAY | 10:10–11:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000vfvgsw65qvaaf | cmv1zr3670019fvgsxkb526g0 | TUESDAY | 10:10–11:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003rfvgsxu78ak5c | cmv1zr36a009afvgsz3zdn67a | TUESDAY | 10:10–11:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000efvgszja9qpa0 | cmv1zr36a009bfvgs8mcjz3dw | WEDNESDAY | 09:10–10:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr3670010fvgszxnm4ve0 | cmv1zr367001ifvgs7f5uj4ip | WEDNESDAY | 09:10–10:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003sfvgsjlw7yd0e | cmv1zr368003ufvgszvw52tpi | WEDNESDAY | 09:10–10:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367000ffvgs6lffg2aq | cmv1zr36a009cfvgsghh5hulx | WEDNESDAY | 10:10–11:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr3670011fvgsnjmvns75 | cmv1zr367001jfvgskc6d0dg1 | WEDNESDAY | 10:10–11:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003tfvgsoezzdkf5 | cmv1zr368003vfvgs7nzo10nk | WEDNESDAY | 10:10–11:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367002ofvgs6qhi8jk8 | cmv1zr36a008zfvgsiqi55n5i | WEDNESDAY | 12:10–13:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367002pfvgsdzec1bha | cmv1zr36a0090fvgs2ip8dhgt | WEDNESDAY | 13:10–14:10 | DEPSTAR-CE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003kfvgs1ye32dhm | cmv1zr369008nfvgsb84kedaz | THURSDAY | 09:10–10:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003lfvgs7ogp0zsg | cmv1zr369008ofvgsv0n0bsn7 | THURSDAY | 10:10–11:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367003cfvgshz8mihgw | cmv1zr368003efvgsbztyg0rl | THURSDAY | 12:10–13:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr368003dfvgsoay77cmr | cmv1zr368003ffvgs1pv68d3c | THURSDAY | 13:10–14:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr3670020fvgs8eonw6gi | cmv1zr3670038fvgszzb39z93 | SATURDAY | 09:10–10:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr3670021fvgsyuaumbz0 | cmv1zr3670039fvgsq1uyl626 | SATURDAY | 10:10–11:10 | DEPSTAR-CSE-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367002cfvgsuyrfe4wt | cmv1zr3670030fvgs4slt4e9h | SATURDAY | 12:10–13:10 | DEPSTAR-IT-BIGLAB | laboratory |
| cmv1zmwri0003fvgsu17bhpn4 | cmv1zr367002dfvgsqftumcg7 | cmv1zr3670031fvgsd4gvn9w9 | SATURDAY | 13:10–14:10 | DEPSTAR-IT-BIGLAB | laboratory |

The SQL pair audit is conservative about dated holidays/leave. The full migration test expands actual teaching dates and confirms a real exclusion violation in the original data.
