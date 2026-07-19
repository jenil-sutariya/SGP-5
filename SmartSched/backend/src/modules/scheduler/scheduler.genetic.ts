import { EngineContext, EngineResult, ScheduledAssignment, SessionRequest } from './scheduler.types';
import { SchedulingEngine } from './scheduler.engine';

function cloneAssignments(a: ScheduledAssignment[]): ScheduledAssignment[] {
  return a.map((x) => ({ ...x, timeSlotIds: [...x.timeSlotIds] }));
}

function fitness(result: EngineResult, totalRequests: number): number {
  const coverage = (result.assignments.length / Math.max(1, totalRequests)) * 1000;
  return coverage + result.score;
}

/**
 * Genetic algorithm polish layer over a greedy seed solution.
 */
export class GeneticOptimizer {
  optimize(
    ctx: EngineContext,
    seed: EngineResult,
    populationSize: number,
    mutationRate: number,
    generations: number
  ): EngineResult {
    if (populationSize < 2 || generations < 1) return seed;

    const engine = new SchedulingEngine();
    let population: EngineResult[] = [seed];

    // Seed population with greedy variants by shuffling request priority noise
    for (let i = 1; i < populationSize; i++) {
      const noisyCtx: EngineContext = {
        ...ctx,
        requests: ctx.requests.map((r) => ({
          ...r,
          priority: r.priority + (Math.random() * 20 - 10),
        })),
      };
      population.push(engine.run(noisyCtx));
    }

    let best = population.reduce((a, b) =>
      fitness(a, ctx.requests.length) >= fitness(b, ctx.requests.length) ? a : b
    );

    for (let gen = 0; gen < generations; gen++) {
      population.sort(
        (a, b) => fitness(b, ctx.requests.length) - fitness(a, ctx.requests.length)
      );
      const next: EngineResult[] = population.slice(0, Math.ceil(populationSize / 4));

      while (next.length < populationSize) {
        const p1 = population[Math.floor(Math.random() * Math.min(population.length, 10))];
        const p2 = population[Math.floor(Math.random() * Math.min(population.length, 10))];
        let child = this.crossover(p1, p2, ctx);

        if (Math.random() < mutationRate) {
          child = this.mutate(child, ctx);
        }
        next.push(child);
      }

      population = next;
      const genBest = population.reduce((a, b) =>
        fitness(a, ctx.requests.length) >= fitness(b, ctx.requests.length) ? a : b
      );
      if (fitness(genBest, ctx.requests.length) > fitness(best, ctx.requests.length)) {
        best = genBest;
      }
    }

    return best;
  }

  private crossover(a: EngineResult, b: EngineResult, ctx: EngineContext): EngineResult {
    const cut = Math.floor(a.assignments.length / 2);
    const chosen = [
      ...cloneAssignments(a.assignments.slice(0, cut)),
      ...cloneAssignments(b.assignments.slice(cut)),
    ];

    // Rebuild via engine with locked early assignments simulated by priority boost
    const assignedIds = new Set(chosen.map((c) => c.requestId));
    const remaining = ctx.requests.filter((r) => !assignedIds.has(r.id));
    const engine = new SchedulingEngine();

    // Pre-seed by running remaining only — approximate by boosting remaining priorities
    const hybridCtx: EngineContext = {
      ...ctx,
      requests: [
        ...ctx.requests.filter((r) => assignedIds.has(r.id)).map((r) => ({ ...r, priority: r.priority + 1000 })),
        ...remaining,
      ],
    };
    return engine.run(hybridCtx);
  }

  private mutate(individual: EngineResult, ctx: EngineContext): EngineResult {
    if (!individual.assignments.length) return individual;
    const engine = new SchedulingEngine();
    const dropCount = Math.max(1, Math.floor(individual.assignments.length * 0.1));
    const dropped = new Set(
      [...individual.assignments]
        .sort(() => Math.random() - 0.5)
        .slice(0, dropCount)
        .map((a) => a.requestId)
    );

    const hybridCtx: EngineContext = {
      ...ctx,
      requests: ctx.requests.map((r) =>
        dropped.has(r.id) ? { ...r, priority: r.priority + Math.random() * 15 } : r
      ),
    };
    return engine.run(hybridCtx);
  }
}

export const geneticOptimizer = new GeneticOptimizer();

export function computeRequestPriority(req: Omit<SessionRequest, 'priority' | 'id'> & { id?: string }): number {
  let p = 0;
  if (req.isLab) p += 50;
  p += req.consecutiveSlots * 15;
  if (req.difficulty === 'HARD') p += 20;
  if (req.subjectType === 'LAB') p += 10;
  p += Math.min(req.requiredCapacity / 10, 20);
  return p;
}
