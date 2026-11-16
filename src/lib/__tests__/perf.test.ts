import { expect, it } from 'vitest';
import { draw, validateAssignments, type DrawInput } from '../draw';

it('draws 1,000 participants with department rules quickly (NFR-04)', () => {
  const input: DrawInput = {
    participants: Array.from({ length: 1000 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      department: `d${i % 12}`,
    })),
    exclusions: [],
    rules: { mode: 'random', avoidSameDepartment: true, avoidPreviousPairs: false, avoidReciprocal: true },
  };
  const t = performance.now();
  const res = draw(input);
  const ms = performance.now() - t;
  expect(res.ok).toBe(true);
  if (res.ok) expect(validateAssignments(input, res.assignments)).toEqual([]);
  expect(ms).toBeLessThan(1500); // headroom for slower CI runners; ~200 ms locally
});
