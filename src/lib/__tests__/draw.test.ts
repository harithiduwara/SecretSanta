import { describe, expect, it } from 'vitest';
import { buildAllowed, diagnose, draw, validateAssignments, type DrawInput } from '../draw';
import type { DrawRules } from '../types';

const rules = (r: Partial<DrawRules> = {}): DrawInput['rules'] => ({
  mode: 'random',
  avoidSameDepartment: false,
  avoidPreviousPairs: false,
  avoidReciprocal: false,
  ...r,
});
const people = (n: number, dept?: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i}`, department: dept?.(i) }));

describe('draw', () => {
  it('produces a valid derangement for many sizes', () => {
    for (const n of [2, 3, 5, 10, 50, 300]) {
      const input: DrawInput = { participants: people(n), exclusions: [], rules: rules() };
      const res = draw(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(validateAssignments(input, res.assignments)).toEqual([]);
    }
  });

  it('never assigns someone to themselves (statistical run)', () => {
    const input: DrawInput = { participants: people(4), exclusions: [], rules: rules() };
    for (let i = 0; i < 500; i++) {
      const res = draw(input);
      expect(res.ok && res.assignments.every((a) => a.giverId !== a.receiverId)).toBe(true);
    }
  });

  it('honours one-way and mutual exclusions', () => {
    const input: DrawInput = {
      participants: people(4),
      exclusions: [
        { id: 'x1', giverId: 'p0', receiverId: 'p1', mutual: true },
        { id: 'x2', giverId: 'p2', receiverId: 'p3', mutual: false },
      ],
      rules: rules(),
    };
    for (let i = 0; i < 200; i++) {
      const res = draw(input);
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      const m = new Map(res.assignments.map((a) => [a.giverId, a.receiverId]));
      expect(m.get('p0')).not.toBe('p1');
      expect(m.get('p1')).not.toBe('p0');
      expect(m.get('p2')).not.toBe('p3');
    }
  });

  it('avoids same department', () => {
    const input: DrawInput = {
      participants: people(8, (i) => (i % 2 ? 'Sales' : ' sales ')),
      exclusions: [],
      rules: rules({ avoidSameDepartment: true }),
    };
    expect(draw(input).ok).toBe(false);
    const input2: DrawInput = {
      participants: people(8, (i) => (i % 2 ? 'Sales' : 'Eng')),
      exclusions: [],
      rules: rules({ avoidSameDepartment: true }),
    };
    const res = draw(input2);
    expect(res.ok).toBe(true);
    if (res.ok) expect(validateAssignments(input2, res.assignments)).toEqual([]);
  });

  it('avoids previous pairs from history', () => {
    const history = [
      [
        { giverId: 'p0', receiverId: 'p1' },
        { giverId: 'p1', receiverId: 'p2' },
        { giverId: 'p2', receiverId: 'p0' },
      ],
    ];
    const input: DrawInput = {
      participants: people(3),
      exclusions: [],
      rules: rules({ avoidPreviousPairs: true }),
      history,
    };
    const res = draw(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const m = new Map(res.assignments.map((a) => [a.giverId, a.receiverId]));
      expect(m.get('p0')).toBe('p2');
      expect(m.get('p1')).toBe('p0');
    }
  });

  it('avoids reciprocal pairs', () => {
    const input: DrawInput = {
      participants: people(6),
      exclusions: [],
      rules: rules({ avoidReciprocal: true }),
    };
    for (let i = 0; i < 300; i++) {
      const res = draw(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(validateAssignments(input, res.assignments)).toEqual([]);
    }
  });

  it('builds a single loop when requested', () => {
    for (const n of [3, 7, 40]) {
      const input: DrawInput = {
        participants: people(n, (i) => `d${i % 3}`),
        exclusions: [{ id: 'x', giverId: 'p0', receiverId: 'p1', mutual: false }],
        rules: rules({ mode: 'single-loop', avoidSameDepartment: n > 3 }),
      };
      const res = draw(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(validateAssignments(input, res.assignments)).toEqual([]);
    }
  });

  it('reports infeasible configurations with helpful reasons', () => {
    expect(draw({ participants: people(1), exclusions: [], rules: rules() })).toMatchObject({ ok: false });
    const blocked = draw({
      participants: people(3),
      exclusions: [
        { id: 'a', giverId: 'p0', receiverId: 'p1', mutual: false },
        { id: 'b', giverId: 'p0', receiverId: 'p2', mutual: false },
      ],
      rules: rules(),
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toContain('Person 0 has nobody');
    // The reciprocal rule only applies to 3+ people: a 2-person exchange must still be drawable.
    expect(
      diagnose({ participants: people(2), exclusions: [], rules: rules({ avoidReciprocal: true }) }),
    ).toEqual([]);
    expect(
      draw({ participants: people(2), exclusions: [], rules: rules({ avoidReciprocal: true }) }).ok,
    ).toBe(true);
  });

  it('detects impossible matchings that pass the simple pre-check (Hall violation)', () => {
    // p0 and p1 may only give to p2 → no perfect matching.
    const ex = (g: string, r: string) => ({ id: g + r, giverId: g, receiverId: r, mutual: false });
    const input: DrawInput = {
      participants: people(4),
      exclusions: [ex('p0', 'p1'), ex('p0', 'p3'), ex('p1', 'p0'), ex('p1', 'p3')],
      rules: rules(),
    };
    expect(draw(input).ok).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const res = draw({
      participants: [
        { id: 'a', name: 'A' },
        { id: 'a', name: 'B' },
      ],
      exclusions: [],
      rules: rules(),
    });
    expect(res).toMatchObject({ ok: false, reason: 'Duplicate participant ids.' });
  });

  it('is reasonably uniform for small groups', () => {
    const input: DrawInput = { participants: people(3), exclusions: [], rules: rules() };
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const res = draw(input);
      if (res.ok) {
        const k = res.assignments.map((a) => a.receiverId).join(',');
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(2); // the only two derangements of 3
    for (const c of counts.values()) expect(c).toBeGreaterThan(800);
  });
});

describe('validateAssignments', () => {
  const input: DrawInput = {
    participants: people(3),
    exclusions: [],
    rules: rules({ avoidReciprocal: true, mode: 'single-loop' }),
  };
  it('flags broken assignments', () => {
    expect(validateAssignments(input, [{ giverId: 'p0', receiverId: 'p0' }])).toEqual(
      expect.arrayContaining(['Assignment violates a rule.', 'Not every participant is giving.']),
    );
    expect(
      validateAssignments(input, [
        { giverId: 'p0', receiverId: 'p1' },
        { giverId: 'p1', receiverId: 'p1' },
        { giverId: 'zz', receiverId: 'p2' },
      ]),
    ).toEqual(expect.arrayContaining(['Receiver assigned twice.', 'Unknown participant in assignment.']));
  });
  it('flags reciprocal pairs and broken loops', () => {
    const four: DrawInput = {
      participants: people(4),
      exclusions: [],
      rules: rules({ avoidReciprocal: true, mode: 'single-loop' }),
    };
    const errs = validateAssignments(four, [
      { giverId: 'p0', receiverId: 'p1' },
      { giverId: 'p1', receiverId: 'p0' },
      { giverId: 'p2', receiverId: 'p3' },
      { giverId: 'p3', receiverId: 'p2' },
    ]);
    expect(errs).toEqual(
      expect.arrayContaining(['Reciprocal pair found.', 'Assignments do not form a single loop.']),
    );
  });
  it('buildAllowed excludes self', () => {
    expect(buildAllowed(input).get('p0')).toEqual(new Set(['p1', 'p2']));
  });
});
