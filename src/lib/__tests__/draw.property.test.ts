import { describe, expect, it } from 'vitest';
import { allowedPredicate, draw, validateAssignments, type DrawInput } from '../draw';
import type { DrawMode, Exclusion } from '../types';

/** Deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]),
  );
}

/** Brute force: does ANY assignment satisfy every rule? */
function feasible(input: DrawInput): boolean {
  const ids = input.participants.map((p) => p.id);
  const ok = allowedPredicate(input);
  return permutations(ids).some((perm) => {
    const assignments = ids.map((g, i) => ({ giverId: g, receiverId: perm[i]! }));
    if (!assignments.every((a) => ok(a.giverId, a.receiverId))) return false;
    return validateAssignments(input, assignments).length === 0;
  });
}

describe('draw vs brute force (property test)', () => {
  it('finds a valid draw exactly when one exists', () => {
    const rnd = mulberry32(20261116);
    let feasibleCases = 0;
    for (let trial = 0; trial < 600; trial++) {
      const n = 2 + Math.floor(rnd() * 6); // 2..7 people
      const participants = Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        department: rnd() < 0.5 ? `d${Math.floor(rnd() * 3)}` : undefined,
      }));
      const exclusions: Exclusion[] = [];
      const exCount = Math.floor(rnd() * n * 1.5);
      for (let k = 0; k < exCount; k++) {
        const g = Math.floor(rnd() * n);
        const r = Math.floor(rnd() * n);
        if (g !== r)
          exclusions.push({ id: `x${k}`, giverId: `p${g}`, receiverId: `p${r}`, mutual: rnd() < 0.5 });
      }
      const mode: DrawMode = rnd() < 0.3 ? 'single-loop' : 'random';
      const input: DrawInput = {
        participants,
        exclusions,
        rules: {
          mode,
          avoidSameDepartment: rnd() < 0.5,
          avoidPreviousPairs: false,
          avoidReciprocal: rnd() < 0.6,
        },
        rand: (max) => Math.floor(rnd() * max),
      };
      const expected = feasible(input);
      if (expected) feasibleCases++;
      const res = draw(input);
      const context = JSON.stringify({ trial, n, exclusions, rules: input.rules, participants });
      expect(res.ok, context).toBe(expected);
      if (res.ok) expect(validateAssignments(input, res.assignments), context).toEqual([]);
    }
    // Sanity: the generator produces a healthy mix of feasible and infeasible cases.
    expect(feasibleCases).toBeGreaterThan(100);
    expect(feasibleCases).toBeLessThan(550);
  });
});
