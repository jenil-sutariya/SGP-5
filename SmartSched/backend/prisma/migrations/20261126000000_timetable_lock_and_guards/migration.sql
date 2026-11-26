BEGIN;

-- Scope deferred validation queue per institute ('*' = global cross-institute check).
ALTER TABLE scheduling_validation_queue
  DROP CONSTRAINT scheduling_validation_queue_pkey,
  ADD COLUMN scope text NOT NULL DEFAULT '*',
  ADD PRIMARY KEY (transaction_id, scope);

CREATE OR REPLACE FUNCTION scheduling_row_institute(tab text, row_data jsonb) RETURNS text
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT CASE
    WHEN row_data IS NULL THEN NULL
    WHEN tab = 'institutes' THEN row_data->>'id'
    WHEN tab IN ('departments','buildings','timetables','student_batches','users','days','time_slots','holidays') THEN row_data->>'instituteId'
    WHEN tab IN ('faculty','courses','subjects','sections','programs') THEN (
      SELECT d."instituteId" FROM departments d WHERE d.id = row_data->>'departmentId'
    )
    WHEN tab = 'rooms' THEN (
      SELECT b."instituteId" FROM buildings b WHERE b.id = row_data->>'buildingId'
    )
    WHEN tab = 'laboratories' THEN coalesce(
      (SELECT b."instituteId" FROM buildings b WHERE b.id = row_data->>'buildingId'),
      (SELECT d."instituteId" FROM departments d WHERE d.id = row_data->>'departmentId')
    )
    WHEN tab = 'timetable_entries' THEN (
      SELECT t."instituteId" FROM timetables t WHERE t.id = row_data->>'timetableId'
    )
    WHEN tab = 'practical_batches' THEN (
      SELECT d."instituteId" FROM sections s JOIN departments d ON d.id = s."departmentId" WHERE s.id = row_data->>'sectionId'
    )
    WHEN tab = 'subject_requirements' THEN (
      SELECT d."instituteId" FROM subjects sub JOIN departments d ON d.id = sub."departmentId" WHERE sub.id = row_data->>'subjectId'
    )
    WHEN tab IN ('faculty_availability','faculty_preferences','faculty_leaves') THEN (
      SELECT d."instituteId" FROM faculty f JOIN departments d ON d.id = f."departmentId" WHERE f.id = row_data->>'facultyId'
    )
    WHEN tab = 'course_offerings' THEN (
      SELECT d."instituteId" FROM courses c JOIN departments d ON d.id = c."departmentId" WHERE c.id = row_data->>'courseId'
    )
    WHEN tab = 'course_assignments' THEN (
      SELECT d."instituteId" FROM course_offerings o JOIN courses c ON c.id = o."courseId" JOIN departments d ON d.id = c."departmentId" WHERE o.id = row_data->>'courseOfferingId'
    )
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION scheduling_touch() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  old_value jsonb;
  new_value jsonb;
  old_inst text;
  new_inst text;
  scopes text[] := ARRAY[]::text[];
  v_scope text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'users' THEN
      IF ROW(OLD."isActive",OLD."instituteId",OLD."departmentId") IS NOT DISTINCT FROM ROW(NEW."isActive",NEW."instituteId",NEW."departmentId") THEN RETURN NEW; END IF;
    ELSE
      old_value = to_jsonb(OLD)-ARRAY['createdAt','updatedAt','name','code','description','notes','score','publishedAt','generatedAt','version','isLocked'];
      new_value = to_jsonb(NEW)-ARRAY['createdAt','updatedAt','name','code','description','notes','score','publishedAt','generatedAt','version','isLocked'];
      -- Day names define the weekday, unlike cosmetic resource names.
      IF TG_TABLE_NAME <> 'days' AND old_value = new_value THEN RETURN NEW; END IF;
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') THEN
    old_inst := scheduling_row_institute(TG_TABLE_NAME, to_jsonb(OLD));
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    new_inst := scheduling_row_institute(TG_TABLE_NAME, to_jsonb(NEW));
  END IF;

  IF TG_TABLE_NAME IN ('academic_years','semesters') THEN
    scopes := ARRAY['*'];
  ELSIF TG_TABLE_NAME IN ('days','time_slots','holidays','users') THEN
    IF (TG_OP IN ('UPDATE','DELETE') AND old_inst IS NULL) OR (TG_OP IN ('INSERT','UPDATE') AND new_inst IS NULL) THEN
      scopes := ARRAY['*'];
    END IF;
  END IF;

  IF cardinality(scopes) = 0 THEN
    IF old_inst IS NOT NULL THEN scopes := array_append(scopes, old_inst); END IF;
    IF new_inst IS NOT NULL AND new_inst IS DISTINCT FROM old_inst THEN scopes := array_append(scopes, new_inst); END IF;
    -- Child cascade deletes run after the parent row already locked and queued its institute.
    IF cardinality(scopes) = 0 THEN
      IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM scheduling_validation_queue WHERE transaction_id = txid_current()) THEN
        RETURN OLD;
      END IF;
      scopes := ARRAY['*'];
    END IF;
  END IF;

  IF '*' = ANY(scopes) THEN
    IF NOT pg_try_advisory_xact_lock(82451627) THEN
      RAISE EXCEPTION 'SCHEDULE_CONFLICT: Another scheduling or academic change is being saved; retry.' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NOT pg_try_advisory_xact_lock_shared(82451627) THEN
      RAISE EXCEPTION 'SCHEDULE_CONFLICT: Another scheduling or academic change is being saved; retry.' USING ERRCODE='23514';
    END IF;
    FOREACH v_scope IN ARRAY scopes LOOP
      IF NOT pg_try_advisory_xact_lock(82451627, hashtext(v_scope)) THEN
        RAISE EXCEPTION 'SCHEDULE_CONFLICT: Another scheduling or academic change is being saved; retry.' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO scheduling_validation_queue (transaction_id, scope)
  SELECT txid_current(), s FROM unnest(scopes) AS s
  ON CONFLICT DO NOTHING;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION scheduling_validate() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  bad text;
  scopes text[];
  is_global boolean;
BEGIN
  SELECT array_agg(scope) INTO scopes FROM scheduling_validation_queue WHERE transaction_id = txid_current();
  IF scopes IS NULL THEN RETURN NULL; END IF;
  DELETE FROM scheduling_validation_queue WHERE transaction_id = txid_current();
  is_global := '*' = ANY(scopes);

  SELECT t.id INTO bad FROM timetables t JOIN semesters s ON s.id=t."semesterId"
  LEFT JOIN departments d ON d.id=t."departmentId"
  JOIN institutes i ON i.id=t."instituteId"
  WHERE (is_global OR t."instituteId" = ANY(scopes))
    AND (t."academicYearId"<>s."academicYearId" OR (t.status IN ('GENERATED','PUBLISHED') AND NOT i."isActive") OR (d.id IS NOT NULL AND d."instituteId"<>t."instituteId"))
  LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Timetable % has inconsistent institute or academic year.',bad USING ERRCODE='23514'; END IF;

  SELECT id INTO bad FROM semesters WHERE "startDate">"endDate" OR "endDate">"startDate"+interval '2 years' LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Semester % must have a valid date range of at most two years.',bad USING ERRCODE='23514'; END IF;
  SELECT s.id INTO bad FROM semesters s JOIN academic_years a ON a.id=s."academicYearId" WHERE s."startDate"<a."startDate" OR s."endDate">a."endDate" LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Semester % must stay within its academic year dates.',bad USING ERRCODE='23514'; END IF;
  SELECT id INTO bad FROM faculty_leaves WHERE "startDate">"endDate" LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Leave % has an invalid date range.',bad USING ERRCODE='23514'; END IF;
  SELECT id INTO bad FROM time_slots WHERE "startTime" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR "endTime" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR "startTime">="endTime" LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Period % needs valid increasing HH:mm times.',bad USING ERRCODE='23514'; END IF;

  SELECT e.id INTO bad
  FROM timetable_entries e JOIN timetables t ON t.id=e."timetableId"
  JOIN course_offerings o ON o.id=e."courseOfferingId" JOIN courses c ON c.id=o."courseId" JOIN departments cd ON cd.id=c."departmentId"
  JOIN subjects sub ON sub.id=o."subjectId" JOIN departments sd ON sd.id=sub."departmentId"
  JOIN faculty f ON f.id=e."facultyId" JOIN users u ON u.id=f."userId" JOIN departments fd ON fd.id=f."departmentId"
  JOIN days day ON day.id=e."dayId" JOIN time_slots ts ON ts.id=e."timeSlotId"
  JOIN semesters sem ON sem.id=t."semesterId" JOIN academic_years ay ON ay.id=t."academicYearId"
  LEFT JOIN sections sec ON sec.id=e."sectionId" LEFT JOIN departments secd ON secd.id=sec."departmentId"
  LEFT JOIN programs prog ON prog.id=sec."programId" LEFT JOIN student_batches cohort ON cohort.id=sec."batchId"
  LEFT JOIN practical_batches pb ON pb.id=e."practicalBatchId"
  LEFT JOIN rooms r ON r.id=e."roomId" LEFT JOIN buildings rb ON rb.id=r."buildingId" LEFT JOIN departments rd ON rd.id=r."departmentId"
  LEFT JOIN laboratories l ON l.id=e."laboratoryId" LEFT JOIN buildings lb ON lb.id=l."buildingId" LEFT JOIN departments ld ON ld.id=l."departmentId"
  WHERE t.status IN ('GENERATED','PUBLISHED')
    AND (is_global OR t."instituteId" = ANY(scopes))
    AND (
      NOT o."isActive" OR NOT c."isActive" OR NOT sub."isActive" OR NOT f."isActive" OR NOT u."isActive" OR NOT sem."isActive" OR NOT ay."isActive"
      OR NOT cd."isActive" OR NOT sd."isActive" OR NOT fd."isActive"
      OR cd."instituteId"<>t."instituteId" OR sd."instituteId"<>t."instituteId" OR fd."instituteId"<>t."instituteId"
      OR o."semesterId"<>t."semesterId" OR sec.id IS NULL OR NOT sec."isActive" OR NOT secd."isActive" OR NOT prog."isActive"
      OR prog."departmentId"<>sec."departmentId" OR sec."semesterId"<>t."semesterId" OR secd."instituteId"<>t."instituteId"
      OR (t."departmentId" IS NOT NULL AND sec."departmentId"<>t."departmentId")
      OR (o."sectionId" IS NOT NULL AND o."sectionId" IS DISTINCT FROM e."sectionId")
      OR (cohort.id IS NOT NULL AND (NOT cohort."isActive" OR cohort."instituteId"<>t."instituteId" OR cohort."departmentId"<>sec."departmentId"))
      OR (pb.id IS NOT NULL AND (NOT pb."isActive" OR pb."sectionId"<>e."sectionId"))
      OR NOT EXISTS (SELECT 1 FROM course_assignments a WHERE a."courseOfferingId"=o.id AND a."facultyId"=f.id)
      OR NOT day."isWorking" OR NOT ts."isActive" OR ts."isLunchBreak"
      OR (day."instituteId" IS NOT NULL AND day."instituteId"<>t."instituteId") OR (ts."instituteId" IS NOT NULL AND ts."instituteId"<>t."instituteId")
      OR (sub.type='LAB' AND (l.id IS NULL OR r.id IS NOT NULL OR NOT e."isLab"))
      OR (sub.type<>'LAB' AND (r.id IS NULL OR l.id IS NOT NULL OR e."isLab"))
      OR (r.id IS NOT NULL AND (NOT r."isActive" OR NOT rb."isActive" OR rb."instituteId" IS DISTINCT FROM t."instituteId" OR (rd.id IS NOT NULL AND rd."instituteId"<>t."instituteId")))
      OR (l.id IS NOT NULL AND (NOT l."isActive" OR NOT lb."isActive" OR lb."instituteId" IS DISTINCT FROM t."instituteId" OR ld."instituteId"<>t."instituteId"))
      OR coalesce(r.capacity,l.capacity)<coalesce(pb.capacity,sec.capacity,o."maxStudents")
      OR EXISTS (SELECT 1 FROM faculty_availability a WHERE a."facultyId"=f.id AND a."dayId"=e."dayId" AND a."timeSlotId"=e."timeSlotId" AND NOT a."isAvailable")
      OR EXISTS (SELECT 1 FROM faculty_preferences p WHERE p."facultyId"=f.id AND p."preferenceType"='UNAVAILABLE' AND (p."dayId" IS NULL OR p."dayId"=e."dayId") AND (p."timeSlotId" IS NULL OR p."timeSlotId"=e."timeSlotId"))
      OR EXISTS (SELECT 1 FROM subject_requirements q WHERE q."subjectId"=sub.id AND (
        (q."roomTypeId" IS NOT NULL AND q."roomTypeId" IS DISTINCT FROM coalesce(r."roomTypeId",l."roomTypeId"))
        OR q."minCapacity">coalesce(r.capacity,l.capacity)
        OR NOT scheduling_equipment(q.equipment) <@ scheduling_equipment(coalesce(r.equipment,l.equipment,'') || CASE WHEN r."hasProjector" THEN ',projector' ELSE '' END || CASE WHEN r."hasAC" THEN ',ac' ELSE '' END || CASE WHEN r."hasWhiteboard" THEN ',whiteboard' ELSE '' END)
      ))
    ) LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Entry % would violate institute, academic, faculty or venue requirements. Unpublish/archive or repair the affected timetable first.',bad USING ERRCODE='23514'; END IF;

  WITH blocks AS (
    SELECT e.*,s.type,s."labHours",s."weeklyHours",ts."startTime",ts."endTime",
    lag(ts."endTime") OVER (PARTITION BY e."timetableId",e."sessionId" ORDER BY ts."startTime",e.id) previous_end
    FROM timetable_entries e JOIN timetables t ON t.id=e."timetableId" JOIN time_slots ts ON ts.id=e."timeSlotId"
    JOIN course_offerings o ON o.id=e."courseOfferingId" JOIN subjects s ON s.id=o."subjectId"
    WHERE t.status IN ('GENERATED','PUBLISHED') AND (is_global OR t."instituteId" = ANY(scopes))
  ) SELECT "sessionId" INTO bad FROM blocks GROUP BY "timetableId","sessionId"
  HAVING count(*)<>max(CASE WHEN type='LAB' THEN greatest(2,"labHours") WHEN type='PRACTICAL' AND "weeklyHours"<>1 THEN 2 ELSE 1 END)
    OR count(DISTINCT ROW("courseOfferingId","facultyId","roomId","laboratoryId","sectionId","practicalBatchId","dayId"))<>1
    OR bool_or(previous_end IS NOT NULL AND previous_end<>"startTime") LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Session % must retain all consecutive periods with one teacher, venue and group.',bad USING ERRCODE='23514'; END IF;

  -- Published teaching counts must remain complete after academic edits, including when metadata.sectionId is ''.
  WITH required AS (
    SELECT o.id, s.code, pb.id batch,
      CASE WHEN s.type='LAB' THEN greatest(2,s."labHours") WHEN s.type='PRACTICAL' THEN CASE WHEN s."weeklyHours"=1 THEN 1 ELSE 2 END ELSE s."weeklyHours" END expected,
      EXISTS (SELECT 1 FROM timetables t WHERE t.status='PUBLISHED' AND t."semesterId"=o."semesterId" AND t."instituteId"=d."instituteId"
        AND (t."departmentId" IS NULL OR t."departmentId"=sec."departmentId") AND (nullif(t.metadata->>'sectionId','') IS NULL OR t.metadata->>'sectionId'=sec.id)) published
    FROM course_offerings o JOIN subjects s ON s.id=o."subjectId" JOIN sections sec ON sec.id=o."sectionId" JOIN departments d ON d.id=sec."departmentId"
    LEFT JOIN practical_batches pb ON pb."sectionId"=sec.id AND pb."isActive" AND s.type='LAB'
    WHERE o."isActive" AND (is_global OR d."instituteId" = ANY(scopes))
  ) SELECT r.id INTO bad FROM required r WHERE (
    SELECT count(*) FROM timetable_entries e JOIN timetables t ON t.id=e."timetableId" WHERE t.status IN ('GENERATED','PUBLISHED') AND e."courseOfferingId"=r.id AND e."practicalBatchId" IS NOT DISTINCT FROM r.batch
  ) > r.expected OR (r.published AND (
    SELECT count(*) FROM timetable_entries e JOIN timetables t ON t.id=e."timetableId" WHERE t.status IN ('GENERATED','PUBLISHED') AND e."courseOfferingId"=r.id AND e."practicalBatchId" IS NOT DISTINCT FROM r.batch
  ) <> r.expected) LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Offering % has missing published teaching or excess generated periods.',bad USING ERRCODE='23514'; END IF;

  WITH expected AS (
    SELECT e.id||':'||dt.day::date||':'||resource.kind AS id,
      e.id AS "entryId", resource.kind AS "resourceKind", resource.id AS "resourceId",
      dt.day::date AS "serviceDate",
      tsrange(dt.day::date+ts."startTime"::time,dt.day::date+ts."endTime"::time,'[)') AS period,
      CASE WHEN resource.kind='SECTION' AND pb.id IS NOT NULL THEN int8range(pb."reservationIndex",pb."reservationIndex"::bigint+1,'[)') ELSE int8range(NULL,NULL,'()') END AS audience
    FROM timetable_entries e JOIN timetables t ON t.id=e."timetableId" JOIN semesters s ON s.id=t."semesterId"
    JOIN days d ON d.id=e."dayId" JOIN time_slots ts ON ts.id=e."timeSlotId" LEFT JOIN practical_batches pb ON pb.id=e."practicalBatchId"
    CROSS JOIN LATERAL generate_series(s."startDate"::date,s."endDate"::date,interval '1 day') dt(day)
    CROSS JOIN LATERAL (VALUES ('ROOM',e."roomId"),('LAB',e."laboratoryId"),('FACULTY',e."facultyId"),('SECTION',e."sectionId")) resource(kind,id)
    WHERE t.status IN ('GENERATED','PUBLISHED') AND resource.id IS NOT NULL
      AND (is_global OR t."instituteId" = ANY(scopes))
      AND extract(isodow FROM dt.day)=CASE d.name WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4 WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 ELSE 7 END
      AND NOT EXISTS (SELECT 1 FROM holidays h WHERE (h."instituteId" IS NULL OR h."instituteId"=t."instituteId") AND ((h."isRecurring" AND to_char(h.date,'MM-DD')=to_char(dt.day,'MM-DD')) OR (NOT h."isRecurring" AND h."academicYearId"=t."academicYearId" AND h.date::date=dt.day::date)))
      AND NOT EXISTS (SELECT 1 FROM faculty_leaves f WHERE f."facultyId"=e."facultyId" AND f.status='APPROVED' AND dt.day::date BETWEEN f."startDate"::date AND f."endDate"::date)
  ),
  deleted AS (
    DELETE FROM timetable_reservations r
    WHERE (is_global
           OR NOT EXISTS (SELECT 1 FROM timetable_entries e WHERE e.id = r."entryId")
           OR EXISTS (SELECT 1 FROM timetable_entries e JOIN timetables t ON t.id = e."timetableId" WHERE e.id = r."entryId" AND t."instituteId" = ANY(scopes)))
      AND NOT EXISTS (SELECT 1 FROM expected x WHERE x.id = r.id)
  )
  INSERT INTO timetable_reservations (id,"entryId","resourceKind","resourceId","serviceDate",period,audience)
  SELECT id,"entryId","resourceKind","resourceId","serviceDate",period,audience FROM expected
  ON CONFLICT (id) DO UPDATE SET
    "entryId"=excluded."entryId","resourceKind"=excluded."resourceKind","resourceId"=excluded."resourceId",
    "serviceDate"=excluded."serviceDate",period=excluded.period,audience=excluded.audience
  WHERE ROW(timetable_reservations."entryId",timetable_reservations."resourceKind",timetable_reservations."resourceId",timetable_reservations."serviceDate",timetable_reservations.period,timetable_reservations.audience)
    IS DISTINCT FROM ROW(excluded."entryId",excluded."resourceKind",excluded."resourceId",excluded."serviceDate",excluded.period,excluded.audience);

  SELECT r."resourceId" INTO bad
  FROM timetable_reservations r
  JOIN faculty f ON f.id = r."resourceId"
  JOIN departments d ON d.id = f."departmentId"
  WHERE r."resourceKind" = 'FACULTY'
    AND (is_global OR d."instituteId" = ANY(scopes))
  GROUP BY r."resourceId",r."serviceDate",f."maxHoursPerDay"
  HAVING sum(extract(epoch FROM (upper(r.period)-lower(r.period)))/3600)>f."maxHoursPerDay"
  LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Faculty % exceeds daily teaching hours.',bad USING ERRCODE='23514'; END IF;

  SELECT r."resourceId" INTO bad
  FROM timetable_reservations r
  JOIN faculty f ON f.id = r."resourceId"
  JOIN departments d ON d.id = f."departmentId"
  WHERE r."resourceKind" = 'FACULTY'
    AND (is_global OR d."instituteId" = ANY(scopes))
  GROUP BY r."resourceId",date_trunc('week',r."serviceDate"),f."maxHoursPerWeek"
  HAVING sum(extract(epoch FROM (upper(r.period)-lower(r.period)))/3600)>f."maxHoursPerWeek"
  LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULE_CONFLICT: Faculty % exceeds weekly teaching hours.',bad USING ERRCODE='23514'; END IF;

  RETURN NULL;
END $$;

COMMIT;
