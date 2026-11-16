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
/** Returns a fast `(giver, receiver) => allowed?` predicate honouring every hard constraint except reciprocity. */
export function allowedPredicate(input: DrawInput): (g: ID, r: ID) => boolean {
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
  const dept = new Map<ID, string>(
    rules.avoidSameDepartment
      ? participants.map((p) => [p.id, p.department?.trim().toLowerCase() || ''])
      : [],
  );
  return (g, r) => {
    if (g === r || forbidden.get(g)?.has(r)) return false;
    const gd = dept.get(g);
    return !(gd && gd === dept.get(r));
  };
}

/** Builds giver → set of allowed receivers honouring every hard constraint except reciprocity. */
export function buildAllowed(input: DrawInput): Map<ID, Set<ID>> {
  const ok = allowedPredicate(input);
  const ids = input.participants.map((p) => p.id);
  const allowed = new Map<ID, Set<ID>>();
  for (const g of ids) {
    const set = new Set<ID>();
    for (const r of ids) if (ok(g, r)) set.add(r);
    allowed.set(g, set);
  }
  return allowed;
}

/**
 * Lazy constraint graph. Large rosters (thousands of people) make a fully materialised n² adjacency table
 * expensive, so pairs are checked on demand and neighbour lists are only built for nodes that need them.
 */
class Graph {
  private cache = new Map<ID, ID[]>();
  constructor(
    readonly ids: ID[],
    readonly ok: (g: ID, r: ID) => boolean,
    private rand: (n: number) => number,
  ) {}
  /** Allowed receivers of `g`, in random order (cached). */
  neighbours(g: ID): ID[] {
    let list = this.cache.get(g);
    if (!list) {
      list = shuffle(
        this.ids.filter((r) => this.ok(g, r)),
        this.rand,
      );
      this.cache.set(g, list);
    }
    return list;
  }
}

/** Fast pre-flight check that surfaces obviously impossible configurations. */
export function diagnose(
  input: DrawInput,
  ok: (g: ID, r: ID) => boolean = allowedPredicate(input),
): string[] {
  const issues: string[] = [];
  const n = input.participants.length;
  if (n < 2) issues.push('At least 2 participants are required.');
  if (n < 2) return issues;
  const ids = input.participants.map((p) => p.id);
  // Early-exit scans: typically O(n) overall, only O(n²) when something really is blocked.
  for (const p of input.participants) {
    if (!ids.some((r) => ok(p.id, r))) issues.push(`${p.name} has nobody they are allowed to give to.`);
    if (!ids.some((g) => ok(g, p.id))) issues.push(`Nobody is allowed to give to ${p.name}.`);
  }
  return issues;
}

/**
 * Randomised perfect matching: a greedy random pass, then Kuhn's augmenting paths for anyone left over.
 * Polynomial time and guaranteed to find a valid assignment if one exists, which matters for large orgs.
 */
function matchRandom(graph: Graph, rand: (n: number) => number, avoidReciprocal: boolean) {
  const { ids, ok } = graph;
  const owner = new Map<ID, ID>(); // receiver → giver
  const giverOf = new Map<ID, ID>(); // giver → receiver
  const free = shuffle(ids, rand); // receivers not yet taken (swap-remove)
  const freeIdx = new Map(free.map((r, i) => [r, i]));
  /** Assigns a currently free receiver `r` to `g`. */
  const take = (g: ID, r: ID) => {
    owner.set(r, g);
    giverOf.set(g, r);
    const i = freeIdx.get(r);
    if (i !== undefined) {
      const last = free.pop()!;
      if (last !== r) {
        free[i] = last;
        freeIdx.set(last, i);
      }
      freeIdx.delete(r);
    }
  };

  /** Picks a free receiver allowed for `g`, scanning from a random offset (free list is small late on). */
  const takeFree = (g: ID, seen?: Set<ID>): boolean => {
    const off = free.length ? rand(free.length) : 0;
    for (let k = 0; k < free.length; k++) {
      const r = free[(off + k) % free.length]!;
      if (!seen?.has(r) && ok(g, r)) {
        seen?.add(r);
        take(g, r);
        return true;
      }
    }
    return false;
  };

  const augment = (g: ID, seen: Set<ID>): boolean => {
    // Look-ahead: a directly reachable free receiver ends the augmenting path immediately.
    if (takeFree(g, seen)) return true;
    for (const r of graph.neighbours(g)) {
      if (seen.has(r)) continue;
      seen.add(r);
      const cur = owner.get(r);
      if (cur === undefined) {
        take(g, r);
        return true;
      }
      // Try to move the current owner elsewhere; on success `r` becomes ours.
      if (augment(cur, seen)) {
        owner.set(r, g);
        giverOf.set(g, r);
        return true;
      }
    }
    return false;
  };

  for (const g of shuffle(ids, rand)) {
    // Greedy first (cheap, almost always succeeds), then an augmenting path.
    if (!takeFree(g) && !augment(g, new Set())) return null;
  }

  if (avoidReciprocal && ids.length > 2) {
    // Repair 2-cycles with local swaps: for A↔B pick another pair C→D and rewire to A→D, C→B if allowed.
    const isTwoCycle = (x: ID) => giverOf.get(giverOf.get(x)!) === x;
    const pending = ids.filter(isTwoCycle);
    for (let guard = 0; pending.length && guard < ids.length * 20; guard++) {
      const a = pending.pop()!;
      if (!isTwoCycle(a)) continue;
      const b = giverOf.get(a)!;
      let fixed = false;
      const off = rand(ids.length);
      for (let k = 0; k < ids.length; k++) {
        const c = ids[(off + k) % ids.length]!;
        if (c === a || c === b) continue;
        const d = giverOf.get(c)!;
        if (d !== a && ok(a, d) && ok(c, b) && giverOf.get(d) !== a && giverOf.get(b) !== c) {
          giverOf.set(a, d);
          giverOf.set(c, b);
          fixed = true;
          break;
        }
      }
      if (!fixed) return null;
    }
    if (ids.some(isTwoCycle)) return null;
  }
  return giverOf;
}

const toMap = (path: ID[]) => {
  const m = new Map<ID, ID>();
  for (let i = 0; i < path.length; i++) m.set(path[i]!, path[(i + 1) % path.length]!);
  return m;
};

/**
 * Fast path for single-loop mode: randomised greedy walks. On typical rosters a walk that always steps to a
 * random unused allowed receiver closes into a valid cycle within a few tries, in roughly O(n) expected time.
 */
function greedyLoop(graph: Graph, rand: (n: number) => number, attempts: number) {
  const { ids, ok } = graph;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const unused = shuffle(ids, rand);
    const start = unused.pop()!;
    const path: ID[] = [start];
    let cur = start;
    let stuck = false;
    while (unused.length) {
      const off = rand(unused.length);
      let found = -1;
      for (let k = 0; k < unused.length; k++) {
        const idx = (off + k) % unused.length;
        if (ok(cur, unused[idx]!)) {
          found = idx;
          break;
        }
      }
      if (found < 0) {
        stuck = true;
        break;
      }
      cur = unused[found]!;
      unused[found] = unused[unused.length - 1]!;
      unused.pop();
      path.push(cur);
    }
    if (!stuck && ok(cur, start)) return toMap(path);
  }
  return null;
}

/** Single gift chain: greedy walks first, then a bounded randomised DFS for a Hamiltonian cycle. */
function singleLoop(graph: Graph, rand: (n: number) => number, budget = 250_000) {
  const quick = greedyLoop(graph, rand, 64);
  if (quick) return quick;
  const { ids, ok } = graph;
  const n = ids.length;
  // The Warnsdorff ordering costs O(degree²) per step, so only use it where that stays cheap.
  const useHeuristic = n <= 300;
  const start = ids[rand(n)]!;
  const path: ID[] = [start];
  const used = new Set<ID>([start]);
  let steps = 0;
  const countFree = (x: ID) => graph.neighbours(x).reduce((c, r) => (used.has(r) ? c : c + 1), 0);
  const dfs = (): boolean => {
    if (++steps > budget) return false;
    const last = path[path.length - 1]!;
    if (path.length === n) return ok(last, start);
    let next = graph.neighbours(last).filter((r) => !used.has(r));
    if (useHeuristic) {
      const freeCount = new Map(next.map((r) => [r, countFree(r)]));
      next = next.sort((x, y) => freeCount.get(x)! - freeCount.get(y)!);
    }
    for (const r of next) {
      used.add(r);
      path.push(r);
      if (dfs()) return true;
      path.pop();
      used.delete(r);
    }
    return false;
  };
  return dfs() ? toMap(path) : null;
}

export function draw(input: DrawInput): DrawResult {
  const rand = input.rand ?? secureRandomInt;
  const ids = input.participants.map((p) => p.id);
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'Duplicate participant ids.' };
  const ok = allowedPredicate(input);
  const issues = diagnose(input, ok);
  if (issues.length) return { ok: false, reason: issues.join(' ') };
  const graph = new Graph(ids, ok, rand);

  let result: Map<ID, ID> | null = null;
  if (input.rules.mode === 'single-loop') {
    result = singleLoop(graph, rand);
  } else {
    // A few attempts: matching is exact, but reciprocity repair is heuristic.
    for (let attempt = 0; attempt < 8 && !result; attempt++)
      result = matchRandom(graph, rand, input.rules.avoidReciprocal);
    // A single loop of 3+ people is never reciprocal, so try that before giving up.
    if (!result && input.rules.avoidReciprocal && ids.length > 2) result = singleLoop(graph, rand);
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
  const isAllowed = allowedPredicate(input);
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
    if (!isAllowed(a.giverId, a.receiverId)) errors.push('Assignment violates a rule.');
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
