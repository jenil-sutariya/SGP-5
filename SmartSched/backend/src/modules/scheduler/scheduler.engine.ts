import {
  EngineContext,
  EngineResult,
  ScheduledAssignment,
  SessionRequest,
  SlotCandidate,
} from './scheduler.types';

type Occupancy = Set<string>;

function occKey(dayId: string, slotId: string, resourceId: string): string {
  return `${dayId}|${slotId}|${resourceId}`;
}

export class SchedulingEngine {
  private facultyOcc: Occupancy = new Set();
  private roomOcc: Occupancy = new Set();
  private labOccupancyMap = new Map<string, number>();
  private sectionTheoryOcc: Occupancy = new Set();
  private batchOcc: Occupancy = new Set();
  private facultyDayCount = new Map<string, number>();
  private facultyWeekCount = new Map<string, number>();
  private roomAssignmentsCount = new Map<string, number>();
  private labAssignmentsCount = new Map<string, number>();

  run(ctx: EngineContext): EngineResult {
    this.reset();
    const sorted = [...ctx.requests].sort((a, b) => b.priority - a.priority);
    const assignments: ScheduledAssignment[] = [];
    const unassigned: SessionRequest[] = [];
    let iterations = 0;

    // Group lab requests by section first, rotating subjects across batches
    const labGroupsBySection = new Map<string, SessionRequest[][]>();
    const sectionLabRequests = new Map<string, SessionRequest[]>();
    for (const r of ctx.requests) {
      if (r.isLab && r.sectionId) {
        if (!sectionLabRequests.has(r.sectionId)) {
          sectionLabRequests.set(r.sectionId, []);
        }
        sectionLabRequests.get(r.sectionId)!.push(r);
      }
    }

    for (const [sectionId, requests] of sectionLabRequests.entries()) {
      // Group by batch
      const batchMap = new Map<string, SessionRequest[]>();
      for (const r of requests) {
        const bId = r.practicalBatchId || 'default';
        if (!batchMap.has(bId)) {
          batchMap.set(bId, []);
        }
        batchMap.get(bId)!.push(r);
      }

      const batches = Array.from(batchMap.keys()).sort();
      const lists = batches.map(b => batchMap.get(b)!);
      
      const maxLen = Math.max(...lists.map(l => l.length));
      const sectionGroups: SessionRequest[][] = [];

      for (let i = 0; i < maxLen; i++) {
        const group: SessionRequest[] = [];
        for (let bIdx = 0; bIdx < lists.length; bIdx++) {
          const list = lists[bIdx];
          const reqIdx = (i + bIdx) % list.length;
          const req = list[reqIdx];
          if (req) {
            group.push(req);
          }
        }
        if (group.length > 0) {
          sectionGroups.push(group);
        }
      }
      labGroupsBySection.set(sectionId, sectionGroups);
    }

    const scheduledRequestIds = new Set<string>();

    for (const request of sorted) {
      if (scheduledRequestIds.has(request.id)) {
        continue;
      }

      iterations += 1;
      if (iterations > ctx.maxIterations) {
        unassigned.push(request);
        continue;
      }

      if (request.isLab && request.sectionId) {
        const sectionGroups = labGroupsBySection.get(request.sectionId) || [];
        const group = sectionGroups.find(g => g.some(r => r.id === request.id));

        if (group) {
          for (const r of group) {
            scheduledRequestIds.add(r.id);
          }

          const groupCandidate = this.findGroupCandidate(group, ctx);
          if (groupCandidate) {
            for (const a of groupCandidate) {
              assignments.push(a);
            }
          } else {
            for (const r of group) {
              unassigned.push(r);
            }
          }
          continue;
        }
      }

      // Normal scheduling for theory lectures (non-lab or no sectionId)
      const candidates = this.findCandidates(request, ctx);
      if (!candidates.length) {
        const recovered = this.backtrackAssign(request, ctx, assignments, 2);
        if (!recovered) {
          unassigned.push(request);
        } else {
          assignments.push(recovered);
        }
        continue;
      }

      const best = candidates[0];
      const assignment = this.commit(request, best, ctx);
      assignments.push(assignment);
    }

    const score = this.scoreSolution(assignments, unassigned, ctx);
    return { assignments, unassigned, score, iterations };
  }

  private findGroupCandidate(group: SessionRequest[], ctx: EngineContext): ScheduledAssignment[] | null {
    const teachingSlots = ctx.timeSlots.filter((s) => !s.isLunchBreak);
    const slotsNeeded = group[0].consecutiveSlots;

    const candidates: { dayId: string; startSlotId: string; assignments: ScheduledAssignment[]; score: number }[] = [];

    for (const day of ctx.workingDays) {
      for (let i = 0; i < teachingSlots.length; i++) {
        if (i + slotsNeeded > teachingSlots.length) continue;

        const slotGroup = teachingSlots.slice(i, i + slotsNeeded);
        
        let consecutive = true;
        for (let j = 1; j < slotGroup.length; j++) {
          if (slotGroup[j].order !== slotGroup[j - 1].order + 1) {
            consecutive = false;
            break;
          }
        }
        if (!consecutive) continue;

        // Labs must start at valid pair-starts (Periods 1, 3, or 5)
        const LAB_PAIR_STARTS = [1, 4, 7];
        if (!LAB_PAIR_STARTS.includes(slotGroup[0].order)) continue;

        const groupAssignments = this.tryPlaceGroupInSlot(group, day.id, slotGroup.map((s) => s.id), ctx);
        if (groupAssignments) {
          const totalScore = groupAssignments.reduce((sum, a) => {
            const req = group.find((r) => r.id === a.requestId)!;
            return sum + this.scoreCandidate(req, day.id, slotGroup[0].id, a.laboratoryId, undefined, ctx);
          }, 0);

          candidates.push({
            dayId: day.id,
            startSlotId: slotGroup[0].id,
            assignments: groupAssignments,
            score: totalScore,
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // Commit best group assignments to state (occupancy maps, counts)
    for (const a of best.assignments) {
      const req = group.find((r) => r.id === a.requestId)!;
      for (const slotId of a.timeSlotIds) {
        if (a.laboratoryId) {
          const key = occKey(best.dayId, slotId, a.laboratoryId);
          const current = this.labOccupancyMap.get(key) ?? 0;
          this.labOccupancyMap.set(key, current + req.requiredCapacity);
        }
        if (a.roomId) {
          this.roomOcc.add(occKey(best.dayId, slotId, a.roomId));
        }
        this.facultyOcc.add(occKey(best.dayId, slotId, a.facultyId));
        if (a.practicalBatchId) {
          this.batchOcc.add(occKey(best.dayId, slotId, a.practicalBatchId));
        }
        if (a.sectionId) {
          this.sectionTheoryOcc.add(occKey(best.dayId, slotId, a.sectionId));
        }
      }
      
      if (a.laboratoryId) {
        this.labAssignmentsCount.set(a.laboratoryId, (this.labAssignmentsCount.get(a.laboratoryId) ?? 0) + 1);
      }

      const dayKey = `${a.facultyId}|${best.dayId}`;
      const currentDay = this.facultyDayCount.get(dayKey) ?? 0;
      this.facultyDayCount.set(dayKey, currentDay + a.timeSlotIds.length);

      const weekKey = a.facultyId;
      const currentWeek = this.facultyWeekCount.get(weekKey) ?? 0;
      this.facultyWeekCount.set(weekKey, currentWeek + a.timeSlotIds.length);
    }

    return best.assignments;
  }

  private tryPlaceGroupInSlot(
    group: SessionRequest[],
    dayId: string,
    slotIds: string[],
    ctx: EngineContext
  ): ScheduledAssignment[] | null {
    // 1. Verify section is free from any theory classes during this slot
    for (const slotId of slotIds) {
      if (this.sectionTheoryOcc.has(occKey(dayId, slotId, group[0].sectionId!))) {
        return null;
      }
    }

    const assignments: ScheduledAssignment[] = [];
    const usedFaculty = new Set<string>();
    const usedLabs = new Map<string, number>();

    // Sort laboratories by current utilization count to distribute load
    const sortedLabs = [...ctx.laboratories].sort((a, b) => {
      const utilA = this.labAssignmentsCount.get(a.id) ?? 0;
      const utilB = this.labAssignmentsCount.get(b.id) ?? 0;
      return utilA - utilB;
    });

    const match = (index: number): boolean => {
      if (index === group.length) return true;

      const req = group[index];

      // Faculty availability & limits
      if (usedFaculty.has(req.facultyId)) return false;

      const dayKey = `${req.facultyId}|${dayId}`;
      const dayCount = this.facultyDayCount.get(dayKey) ?? 0;
      const maxDay = ctx.facultyMaxPerDay.get(req.facultyId) ?? 4;
      if (dayCount + slotIds.length > maxDay) return false;

      const weekCount = this.facultyWeekCount.get(req.facultyId) ?? 0;
      const maxWeek = ctx.facultyMaxPerWeek.get(req.facultyId) ?? 16;
      if (weekCount + slotIds.length > maxWeek) return false;

      for (const slotId of slotIds) {
        const availKey = `${dayId}|${slotId}`;
        const avail = ctx.facultyAvailability.get(req.facultyId);
        if (avail && avail.size > 0 && !avail.has(availKey)) return false;
        if (this.facultyOcc.has(occKey(dayId, slotId, req.facultyId))) return false;
      }

      // Find a laboratory or classroom for this request strictly by subjectType
      const targetLabs = sortedLabs.map((l) => ({ id: l.id, capacity: l.capacity, departmentId: l.departmentId, isRoom: false }));
      const targetRooms = ctx.rooms.map((r) => ({ id: r.id, capacity: r.capacity, departmentId: r.departmentId, isRoom: true }));
      const venues = req.subjectType === 'LAB' ? targetLabs : targetRooms;

      for (const venue of venues) {
        if (venue.capacity < req.requiredCapacity) continue;
        if (venue.departmentId && req.departmentId && !this.canShareResources(req.departmentId, venue.departmentId, ctx.departmentCodes, ctx.departmentInstitutes)) continue;

        let venueFree = true;
        for (const slotId of slotIds) {
          const currentOccupied = venue.isRoom
            ? (this.roomOcc.has(occKey(dayId, slotId, venue.id)) ? 9999 : 0)
            : (this.labOccupancyMap.get(occKey(dayId, slotId, venue.id)) ?? 0);
          const insideGroupOccupied = usedLabs.get(venue.id) ?? 0;
          if (currentOccupied + insideGroupOccupied + req.requiredCapacity > venue.capacity) {
            venueFree = false;
            break;
          }
        }
        if (!venueFree) continue;

        let batchFree = true;
        for (const slotId of slotIds) {
          if (req.practicalBatchId && this.batchOcc.has(occKey(dayId, slotId, req.practicalBatchId))) {
            batchFree = false;
            break;
          }
        }
        if (!batchFree) continue;

        // Allocate
        usedFaculty.add(req.facultyId);
        const insideGroupOccupied = usedLabs.get(venue.id) ?? 0;
        usedLabs.set(venue.id, insideGroupOccupied + req.requiredCapacity);
        if (venue.isRoom) {
          for (const slotId of slotIds) {
            this.roomOcc.add(occKey(dayId, slotId, venue.id));
          }
        }
        
        assignments.push({
          requestId: req.id,
          courseOfferingId: req.courseOfferingId,
          facultyId: req.facultyId,
          sectionId: req.sectionId,
          practicalBatchId: req.practicalBatchId || null,
          dayId,
          timeSlotIds: slotIds,
          laboratoryId: venue.isRoom ? undefined : venue.id,
          roomId: venue.isRoom ? venue.id : undefined,
          isLab: true,
        });

        if (match(index + 1)) return true;

        // Backtrack
        assignments.pop();
        if (venue.isRoom) {
          for (const slotId of slotIds) {
            this.roomOcc.delete(occKey(dayId, slotId, venue.id));
          }
        }
        usedLabs.set(venue.id, insideGroupOccupied);
        usedFaculty.delete(req.facultyId);
      }

      return false;
    };

    if (match(0)) {
      return assignments;
    }
    return null;
  }

  private reset() {
    this.facultyOcc.clear();
    this.roomOcc.clear();
    this.labOccupancyMap.clear();
    this.sectionTheoryOcc.clear();
    this.batchOcc.clear();
    this.facultyDayCount.clear();
    this.facultyWeekCount.clear();
    this.roomAssignmentsCount.clear();
    this.labAssignmentsCount.clear();
  }

  private findCandidates(request: SessionRequest, ctx: EngineContext): SlotCandidate[] {
    const candidates: SlotCandidate[] = [];
    const teachingSlots = ctx.timeSlots.filter((s) => !s.isLunchBreak);

    for (const day of ctx.workingDays) {
      for (let i = 0; i < teachingSlots.length; i++) {
        const slotsNeeded = request.consecutiveSlots;
        if (i + slotsNeeded > teachingSlots.length) continue;

        const slotGroup = teachingSlots.slice(i, i + slotsNeeded);
        // consecutive by order
        let consecutive = true;
        for (let j = 1; j < slotGroup.length; j++) {
          if (slotGroup[j].order !== slotGroup[j - 1].order + 1) {
            consecutive = false;
            break;
          }
        }
        if (!consecutive) continue;

        if (!this.canPlace(request, day.id, slotGroup.map((s) => s.id), ctx)) continue;

        // Labs must start at a valid pair-start slot (P1, P3, P5 — orders 1, 4, 7)
        // so they never span a break. The consecutive-order check already handles this,
        // but this explicit guard prevents edge cases with non-standard slot layouts.
        if (request.isLab && request.consecutiveSlots >= 2) {
          const LAB_PAIR_STARTS = [1, 4, 7];
          if (!LAB_PAIR_STARTS.includes(slotGroup[0].order)) continue;
        }

        if (request.isLab) {
          const sortedLabs = [...ctx.laboratories].sort((a, b) => {
            const utilA = this.labAssignmentsCount.get(a.id) ?? 0;
            const utilB = this.labAssignmentsCount.get(b.id) ?? 0;
            return utilA - utilB;
          });
          for (const lab of sortedLabs) {
            if (lab.capacity < request.requiredCapacity) continue;
            if (request.departmentId && !this.canShareResources(request.departmentId, lab.departmentId, ctx.departmentCodes, ctx.departmentInstitutes)) continue;
            let free = true;
            for (const s of slotGroup) {
              const currentOccupied = this.labOccupancyMap.get(occKey(day.id, s.id, lab.id)) ?? 0;
              if (currentOccupied + request.requiredCapacity > lab.capacity) {
                free = false;
                break;
              }
            }
            if (!free) continue;
            candidates.push({
              dayId: day.id,
              timeSlotId: slotGroup[0].id,
              dayOrder: day.order,
              slotOrder: slotGroup[0].order,
              laboratoryId: lab.id,
              score: this.scoreCandidate(request, day.id, slotGroup[0].id, lab.id, undefined, ctx),
            });
          }
        } else {
          const sortedRooms = [...ctx.rooms].sort((a, b) => {
            const utilA = this.roomAssignmentsCount.get(a.id) ?? 0;
            const utilB = this.roomAssignmentsCount.get(b.id) ?? 0;
            return utilA - utilB;
          });
          for (const room of sortedRooms) {
            if (room.capacity < request.requiredCapacity) continue;
            if (request.departmentId && !this.canShareResources(request.departmentId, room.departmentId, ctx.departmentCodes, ctx.departmentInstitutes)) continue;
            let free = true;
            for (const s of slotGroup) {
              if (this.roomOcc.has(occKey(day.id, s.id, room.id))) {
                free = false;
                break;
              }
            }
            if (!free) continue;
            candidates.push({
              dayId: day.id,
              timeSlotId: slotGroup[0].id,
              dayOrder: day.order,
              slotOrder: slotGroup[0].order,
              roomId: room.id,
              score: this.scoreCandidate(request, day.id, slotGroup[0].id, undefined, room.id, ctx),
            });
          }
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  private canShareResources(
    deptIdA: string,
    deptIdB: string | null,
    deptCodeMap?: Map<string, string>,
    deptInstMap?: Map<string, string>
  ): boolean {
    if (!deptIdB) return true; // Room/Lab belongs to shared pool (no department assigned)
    if (deptIdA === deptIdB) return true;

    // Check if they belong to the same institute
    if (deptInstMap) {
      const instA = deptInstMap.get(deptIdA);
      const instB = deptInstMap.get(deptIdB);
      if (instA !== instB) return false;
    }

    if (!deptCodeMap) return false;

    const codeA = deptCodeMap.get(deptIdA)?.toUpperCase() || '';
    const codeB = deptCodeMap.get(deptIdB)?.toUpperCase() || '';
    const computerDepts = ['CSE', 'IT', 'CE'];

    return computerDepts.includes(codeA) && computerDepts.includes(codeB);
  }

  private isBatchOfSection(batchId: string, sectionId: string, ctx: EngineContext): boolean {
    for (const o of ctx.requests) {
      if (o.sectionId === sectionId && o.practicalBatchId === batchId) {
        return true;
      }
    }
    return false;
  }

  private canPlace(
    request: SessionRequest,
    dayId: string,
    slotIds: string[],
    ctx: EngineContext
  ): boolean {
    const dayKey = `${request.facultyId}|${dayId}`;
    const dayCount = this.facultyDayCount.get(dayKey) ?? 0;
    const maxDay = ctx.facultyMaxPerDay.get(request.facultyId) ?? 4;
    if (dayCount + slotIds.length > maxDay) return false;

    const weekCount = this.facultyWeekCount.get(request.facultyId) ?? 0;
    const maxWeek = ctx.facultyMaxPerWeek.get(request.facultyId) ?? 16;
    if (weekCount + slotIds.length > maxWeek) return false;

    for (const slotId of slotIds) {
      const availKey = `${dayId}|${slotId}`;
      const avail = ctx.facultyAvailability.get(request.facultyId);
      if (avail && avail.size > 0 && !avail.has(availKey)) return false;

      if (this.facultyOcc.has(occKey(dayId, slotId, request.facultyId))) return false;

      if (request.sectionId) {
        if (this.sectionTheoryOcc.has(occKey(dayId, slotId, request.sectionId))) return false;

        if (request.isLab && request.practicalBatchId) {
          if (this.batchOcc.has(occKey(dayId, slotId, request.practicalBatchId))) return false;
        } else {
          for (const key of this.batchOcc) {
            const prefix = `${dayId}|${slotId}|`;
            if (key.startsWith(prefix)) {
              const activeBatchId = key.substring(prefix.length);
              if (this.isBatchOfSection(activeBatchId, request.sectionId, ctx)) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  }

  private scoreCandidate(
    request: SessionRequest,
    dayId: string,
    slotId: string,
    labId: string | undefined,
    roomId: string | undefined,
    ctx: EngineContext
  ): number {
    let score = 100;
    const prefs = ctx.facultyPreferences.get(request.facultyId) ?? [];
    const key = `${dayId}|${slotId}`;
    for (const p of prefs) {
      if (p.key === key || p.key === `${dayId}|` || p.key === `|${slotId}`) {
        if (p.type === 'PREFERRED') score += p.weight * 5;
        if (p.type === 'AVOID') score -= p.weight * 5;
        if (p.type === 'UNAVAILABLE') score -= 1000;
      }
    }

    if (roomId) {
      const room = ctx.rooms.find((r) => r.id === roomId);
      if (room?.departmentId === request.departmentId) score += 15;
      // prefer tighter fit
      if (room) score += Math.max(0, 20 - (room.capacity - request.requiredCapacity));
      // penalize utilization to balance resource load
      score -= (this.roomAssignmentsCount.get(roomId) ?? 0) * 0.5;
    }
    if (labId) {
      const lab = ctx.laboratories.find((l) => l.id === labId);
      if (lab?.departmentId === request.departmentId) score += 20;
      // penalize utilization to balance resource load
      score -= (this.labAssignmentsCount.get(labId) ?? 0) * 0.5;
    }

    // Spread workload: prefer days with fewer lectures
    const dayCount = this.facultyDayCount.get(`${request.facultyId}|${dayId}`) ?? 0;
    score -= dayCount * 3;

    // Soft: avoid hard subjects in consecutive late slots slightly
    if (request.difficulty === 'HARD') {
      const slot = ctx.timeSlots.find((s) => s.id === slotId);
      if (slot && slot.order >= 6) score -= 8;
    }

    return score;
  }

  private commit(request: SessionRequest, candidate: SlotCandidate, ctx: EngineContext): ScheduledAssignment {
    const teachingSlots = ctx.timeSlots.filter((s) => !s.isLunchBreak);
    const startIdx = teachingSlots.findIndex((s) => s.id === candidate.timeSlotId);
    const slotGroup = teachingSlots.slice(startIdx, startIdx + request.consecutiveSlots);

    for (const s of slotGroup) {
      this.facultyOcc.add(occKey(candidate.dayId, s.id, request.facultyId));
      if (candidate.roomId) this.roomOcc.add(occKey(candidate.dayId, s.id, candidate.roomId));
      
      if (candidate.laboratoryId) {
        const key = occKey(candidate.dayId, s.id, candidate.laboratoryId);
        this.labOccupancyMap.set(key, (this.labOccupancyMap.get(key) ?? 0) + request.requiredCapacity);
      }

      if (request.sectionId) {
        if (request.isLab && request.practicalBatchId) {
          this.batchOcc.add(occKey(candidate.dayId, s.id, request.practicalBatchId));
        } else {
          this.sectionTheoryOcc.add(occKey(candidate.dayId, s.id, request.sectionId));
        }
      }
    }

    if (candidate.roomId) {
      this.roomAssignmentsCount.set(candidate.roomId, (this.roomAssignmentsCount.get(candidate.roomId) ?? 0) + 1);
    }
    if (candidate.laboratoryId) {
      this.labAssignmentsCount.set(candidate.laboratoryId, (this.labAssignmentsCount.get(candidate.laboratoryId) ?? 0) + 1);
    }

    const dayKey = `${request.facultyId}|${candidate.dayId}`;
    this.facultyDayCount.set(dayKey, (this.facultyDayCount.get(dayKey) ?? 0) + slotGroup.length);
    this.facultyWeekCount.set(
      request.facultyId,
      (this.facultyWeekCount.get(request.facultyId) ?? 0) + slotGroup.length
    );

    return {
      requestId: request.id,
      courseOfferingId: request.courseOfferingId,
      facultyId: request.facultyId,
      sectionId: request.sectionId,
      practicalBatchId: request.practicalBatchId,
      dayId: candidate.dayId,
      timeSlotIds: slotGroup.map((s) => s.id),
      roomId: candidate.roomId,
      laboratoryId: candidate.laboratoryId,
      isLab: request.isLab,
    };
  }

  private backtrackAssign(
    request: SessionRequest,
    ctx: EngineContext,
    existing: ScheduledAssignment[],
    depth: number
  ): ScheduledAssignment | null {
    if (depth <= 0) return null;

    for (let i = existing.length - 1; i >= 0; i--) {
      const victim = existing[i];
      const victimReq = ctx.requests.find((r) => r.id === victim.requestId);
      if (!victimReq || victimReq.priority >= request.priority) continue;

      this.uncommit(victim, ctx);
      existing.splice(i, 1);

      const candidates = this.findCandidates(request, ctx);
      if (candidates.length) {
        const assignment = this.commit(request, candidates[0], ctx);
        const victimCandidates = this.findCandidates(victimReq, ctx);
        if (victimCandidates.length) {
          existing.push(this.commit(victimReq, victimCandidates[0], ctx));
          return assignment;
        }
        this.uncommit(assignment, ctx);
        existing.push(this.commit(victimReq, {
          dayId: victim.dayId,
          timeSlotId: victim.timeSlotIds[0],
          dayOrder: 0,
          slotOrder: 0,
          roomId: victim.roomId,
          laboratoryId: victim.laboratoryId,
          score: 0,
        }, ctx));
        continue;
      }

      existing.push(this.commit(victimReq, {
        dayId: victim.dayId,
        timeSlotId: victim.timeSlotIds[0],
        dayOrder: 0,
        slotOrder: 0,
        roomId: victim.roomId,
        laboratoryId: victim.laboratoryId,
        score: 0,
      }, ctx));
    }
    return null;
  }

  private uncommit(assignment: ScheduledAssignment, ctx: EngineContext) {
    const request = ctx.requests.find((r) => r.id === assignment.requestId);
    const capacity = request?.requiredCapacity ?? 20;

    for (const slotId of assignment.timeSlotIds) {
      this.facultyOcc.delete(occKey(assignment.dayId, slotId, assignment.facultyId));
      if (assignment.roomId) this.roomOcc.delete(occKey(assignment.dayId, slotId, assignment.roomId));
      
      if (assignment.laboratoryId) {
        const key = occKey(assignment.dayId, slotId, assignment.laboratoryId);
        const cur = this.labOccupancyMap.get(key) ?? 0;
        if (cur <= capacity) {
          this.labOccupancyMap.delete(key);
        } else {
          this.labOccupancyMap.set(key, cur - capacity);
        }
      }

      if (assignment.sectionId) {
        if (assignment.isLab && assignment.practicalBatchId) {
          this.batchOcc.delete(occKey(assignment.dayId, slotId, assignment.practicalBatchId));
        } else {
          this.sectionTheoryOcc.delete(occKey(assignment.dayId, slotId, assignment.sectionId));
        }
      }
    }
    if (assignment.roomId) {
      const cur = this.roomAssignmentsCount.get(assignment.roomId) ?? 0;
      this.roomAssignmentsCount.set(assignment.roomId, Math.max(0, cur - 1));
    }
    if (assignment.laboratoryId) {
      const cur = this.labAssignmentsCount.get(assignment.laboratoryId) ?? 0;
      this.labAssignmentsCount.set(assignment.laboratoryId, Math.max(0, cur - 1));
    }

    const dayKey = `${assignment.facultyId}|${assignment.dayId}`;
    this.facultyDayCount.set(
      dayKey,
      Math.max(0, (this.facultyDayCount.get(dayKey) ?? 0) - assignment.timeSlotIds.length)
    );
    this.facultyWeekCount.set(
      assignment.facultyId,
      Math.max(0, (this.facultyWeekCount.get(assignment.facultyId) ?? 0) - assignment.timeSlotIds.length)
    );
  }

  private scoreSolution(
    assignments: ScheduledAssignment[],
    unassigned: SessionRequest[],
    ctx: EngineContext
  ): number {
    let score = assignments.length * 100 - unassigned.length * 500;

    // Workload balance
    const loads = [...this.facultyWeekCount.values()];
    if (loads.length) {
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      const variance = loads.reduce((a, b) => a + (b - avg) ** 2, 0) / loads.length;
      score -= variance * 2;
    }

    // Preference satisfaction
    for (const a of assignments) {
      const prefs = ctx.facultyPreferences.get(a.facultyId) ?? [];
      for (const slotId of a.timeSlotIds) {
        const key = `${a.dayId}|${slotId}`;
        for (const p of prefs) {
          if (p.key === key && p.type === 'PREFERRED') score += p.weight;
          if (p.key === key && p.type === 'AVOID') score -= p.weight;
        }
      }
    }

    for (const soft of ctx.softConstraints) {
      score += soft.weight;
    }

    return Math.round(score * 100) / 100;
  }
}

export const schedulingEngine = new SchedulingEngine();
