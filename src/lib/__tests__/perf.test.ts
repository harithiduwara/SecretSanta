import { describe, expect, it } from 'vitest';
import { draw, validateAssignments, type DrawInput } from '../draw';
import type { DrawMode } from '../types';

// NFR-04: large rosters must draw quickly. Limits leave headroom for slow CI runners (~10–300 ms locally).
const roster = (n: number, depts: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, department: `d${i % depts}` }));

describe('performance (NFR-04)', () => {
  const cases: [number, number, DrawMode][] = [
    [1000, 12, 'random'],
    [1000, 12, 'single-loop'],
    [5000, 3, 'random'],
    [5000, 12, 'single-loop'],
  ];
  it.each(cases)('draws %i people / %i departments in %s mode quickly', (n, depts, mode) => {
    const input: DrawInput = {
      participants: roster(n, depts),
      exclusions: [],
      rules: { mode, avoidSameDepartment: true, avoidPreviousPairs: false, avoidReciprocal: true },
    };
    const t = performance.now();
    const res = draw(input);
    const ms = performance.now() - t;
    expect(res.ok).toBe(true);
    if (res.ok) expect(validateAssignments(input, res.assignments)).toEqual([]);
    expect(ms).toBeLessThan(1500);
  });
});
