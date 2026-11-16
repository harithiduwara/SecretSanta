import type { Assignment, DrawRules, Exclusion, ID, Participant } from './types';
import { secureRandomInt, shuffle } from './random';

export interface DrawInput {
  participants: Pick<Participant, 'id' | 'name' | 'department'>[];
  exclusions: Exclusion[];
  rules: Omit<DrawRules, 'pinProtectedLinks'>;
  history?: Assignment[][];
  rand?: (max: number) => number;
}

export type DrawResult =
  { ok: true; assignments: Assignment[] } | { ok: false; reason: string; blocked?: ID[] };

/** Builds giver → set of allowed receivers honouring every hard constraint except reciprocity. */
export function buildAllowed(input: DrawInput): Map<ID, Set<ID>> {
  const { participants, exclusions, rules, history = [] } = input;
  const forbidden = new Map<ID, Set<ID>>();
  const forbid = (a: ID, b: ID) => {
    let s = forbidden.get(a);
    if (!s) forbidden.set(a, (s = new Set()));
    s.add(b);
  };
  for (const e of exclusions) {
    forbid(e.giverId, e.receiverId);
    if (e.mutual) forbid(e.receiverId, e.giverId);
  }
  if (rules.avoidPreviousPairs) {
    for (const round of history) for (const a of round) forbid(a.giverId, a.receiverId);
  }
  const dept = participants.map((p) => p.department?.trim().toLowerCase() || '');
  const allowed = new Map<ID, Set<ID>>();
  participants.forEach((g, gi) => {
    const set = new Set<ID>();
    const blocked = forbidden.get(g.id);
    const gd = rules.avoidSameDepartment ? dept[gi] : '';
    participants.forEach((r, ri) => {
      if (gi === ri || blocked?.has(r.id)) return;
      if (gd && gd === dept[ri]) return;
      set.add(r.id);
    });
    allowed.set(g.id, set);
  });
  return allowed;
}

/** Fast pre-flight check that surfaces obviously impossible configurations. */
export function diagnose(input: DrawInput): string[] {
  const issues: string[] = [];
  const n = input.participants.length;
  if (n < 2) issues.push('At least 2 participants are required.');
  if (n === 2 && input.rules.avoidReciprocal)
    issues.push('With only 2 participants the exchange is necessarily reciprocal.');
  const allowed = buildAllowed(input);
  const name = new Map(input.participants.map((p) => [p.id, p.name]));
  const incoming = new Map<ID, number>(input.participants.map((p) => [p.id, 0]));
  for (const [g, set] of allowed) {
    if (set.size === 0) issues.push(`${name.get(g)} has nobody they are allowed to give to.`);
    for (const r of set) incoming.set(r, (incoming.get(r) ?? 0) + 1);
  }
  for (const [r, c] of incoming)
    if (c === 0 && n >= 2) issues.push(`Nobody is allowed to give to ${name.get(r)}.`);
  return issues;
}

/**
 * Randomised perfect matching (Kuhn's augmenting paths over shuffled adjacency).
 * Polynomial time and guaranteed to find a valid assignment if one exists, which matters for large orgs.
 */
function matchRandom(
  ids: ID[],
  allowed: Map<ID, Set<ID>>,
  rand: (n: number) => number,
  avoidReciprocal: boolean,
) {
  const adj = new Map<ID, ID[]>(ids.map((g) => [g, shuffle([...allowed.get(g)!], rand)]));
  const owner = new Map<ID, ID>(); // receiver → giver
  const giverOf = new Map<ID, ID>(); // giver → receiver

  const tryAssign = (g: ID, seen: Set<ID>): boolean => {
    const options = adj.get(g)!;
    // Greedy pass first: a free receiver avoids a deep augmenting search (huge speed-up on large rosters).
    for (const r of options) {
      if (!seen.has(r) && !owner.has(r)) {
        seen.add(r);
        owner.set(r, g);
        giverOf.set(g, r);
        return true;
      }
    }
    for (const r of options) {
      if (seen.has(r)) continue;
      seen.add(r);
      const cur = owner.get(r);
      if (cur === undefined || tryAssign(cur, seen)) {
        owner.set(r, g);
        giverOf.set(g, r);
        return true;
      }
    }
    return false;
  };

  for (const g of shuffle(ids, rand)) {
    if (!tryAssign(g, new Set())) return null;
  }

  if (avoidReciprocal && ids.length > 2) {
    // Repair 2-cycles with local swaps: for A↔B pick another pair C→D and rewire if allowed.
    for (let guard = 0; guard < ids.length * 20; guard++) {
      const a = ids.find((x) => giverOf.get(giverOf.get(x)!) === x);
      if (!a) break;
      const b = giverOf.get(a)!;
      const candidates = shuffle(
        ids.filter((c) => c !== a && c !== b),
        rand,
      );
      let fixed = false;
      for (const c of candidates) {
        const d = giverOf.get(c)!;
        // a→d, c→b
        if (
          d !== a &&
          allowed.get(a)!.has(d) &&
          allowed.get(c)!.has(b) &&
          giverOf.get(d) !== a &&
          giverOf.get(b) !== c
        ) {
          giverOf.set(a, d);
          giverOf.set(c, b);
          fixed = true;
          break;
        }
      }
      if (!fixed) return null;
    }
    if (ids.some((x) => giverOf.get(giverOf.get(x)!) === x)) return null;
  }
  return giverOf;
}

/** Randomised DFS for a Hamiltonian cycle (everyone in one gift chain). Bounded effort. */
function singleLoop(ids: ID[], allowed: Map<ID, Set<ID>>, rand: (n: number) => number, budget = 250_000) {
  const n = ids.length;
  const start = ids[rand(n)]!;
  const path: ID[] = [start];
  const used = new Set<ID>([start]);
  let steps = 0;
  const dfs = (): boolean => {
    if (++steps > budget) return false;
    const last = path[path.length - 1]!;
    if (path.length === n) return allowed.get(last)!.has(start);
    // Warnsdorff-style heuristic: try receivers with fewest onward options first, random tie-break.
    const next = shuffle(
      [...allowed.get(last)!].filter((r) => !used.has(r)),
      rand,
    ).sort((x, y) => countFree(x) - countFree(y));
    for (const r of next) {
      used.add(r);
      path.push(r);
      if (dfs()) return true;
      path.pop();
      used.delete(r);
    }
    return false;
  };
  const countFree = (x: ID) => {
    let c = 0;
    for (const r of allowed.get(x)!) if (!used.has(r)) c++;
    return c;
  };
  if (!dfs()) return null;
  const m = new Map<ID, ID>();
  for (let i = 0; i < n; i++) m.set(path[i]!, path[(i + 1) % n]!);
  return m;
}

export function draw(input: DrawInput): DrawResult {
  const rand = input.rand ?? secureRandomInt;
  const ids = input.participants.map((p) => p.id);
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'Duplicate participant ids.' };
  const issues = diagnose(input);
  if (issues.length) return { ok: false, reason: issues.join(' ') };

  const allowed = buildAllowed(input);
  let result: Map<ID, ID> | null = null;
  if (input.rules.mode === 'single-loop') {
    result = singleLoop(ids, allowed, rand);
  } else {
    // A few attempts: matching is exact, but reciprocity repair is heuristic.
    for (let attempt = 0; attempt < 8 && !result; attempt++)
      result = matchRandom(ids, allowed, rand, input.rules.avoidReciprocal);
  }
  if (!result)
    return {
      ok: false,
      reason:
        input.rules.mode === 'single-loop'
          ? 'Could not form a single gift chain with these rules. Try relaxing exclusions or switch to random mode.'
          : 'No valid assignment exists with the current rules. Try removing some exclusions.',
    };
  return { ok: true, assignments: ids.map((g) => ({ giverId: g, receiverId: result!.get(g)! })) };
}

/** Independent verifier used by tests and as a defence-in-depth check before persisting a draw. */
export function validateAssignments(input: DrawInput, assignments: Assignment[]): string[] {
  const errors: string[] = [];
  const ids = new Set(input.participants.map((p) => p.id));
  const allowed = buildAllowed(input);
  const givers = new Set<ID>();
  const receivers = new Set<ID>();
  const map = new Map<ID, ID>();
  for (const a of assignments) {
    if (!ids.has(a.giverId) || !ids.has(a.receiverId)) errors.push('Unknown participant in assignment.');
    if (givers.has(a.giverId)) errors.push('Giver assigned twice.');
    if (receivers.has(a.receiverId)) errors.push('Receiver assigned twice.');
    givers.add(a.giverId);
    receivers.add(a.receiverId);
    map.set(a.giverId, a.receiverId);
    if (!allowed.get(a.giverId)?.has(a.receiverId)) errors.push('Assignment violates a rule.');
  }
  if (givers.size !== ids.size) errors.push('Not every participant is giving.');
  if (input.rules.avoidReciprocal && ids.size > 2)
    for (const [g, r] of map) if (map.get(r) === g) errors.push('Reciprocal pair found.');
  if (input.rules.mode === 'single-loop' && ids.size > 0) {
    const first = assignments[0]?.giverId;
    let cur = first;
    let len = 0;
    do {
      cur = cur ? map.get(cur) : undefined;
      len++;
    } while (cur && cur !== first && len <= ids.size);
    if (len !== ids.size) errors.push('Assignments do not form a single loop.');
  }
  return [...new Set(errors)];
}
