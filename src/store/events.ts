import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DrawRules, Exclusion, ID, Participant, SantaEvent } from '../lib/types';
import { accessCode, uid } from '../lib/random';
import { draw, validateAssignments, type DrawResult } from '../lib/draw';
import type { ImportedPerson } from '../lib/csv';

export const DEFAULT_RULES: DrawRules = {
  mode: 'random',
  avoidSameDepartment: false,
  avoidPreviousPairs: true,
  avoidReciprocal: true,
  pinProtectedLinks: false,
};

const now = () => new Date().toISOString();

export function newEvent(partial: Partial<SantaEvent> = {}): SantaEvent {
  const t = now();
  return {
    id: uid('evt'),
    name: 'Holiday Gift Exchange',
    description: '',
    date: '',
    budget: 25,
    currency: 'USD',
    status: 'draft',
    participants: [],
    exclusions: [],
    rules: { ...DEFAULT_RULES },
    assignments: [],
    history: [],
    notified: {},
    audit: [],
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

interface State {
  events: SantaEvent[];
  createEvent: (partial?: Partial<SantaEvent>) => ID;
  updateEvent: (
    id: ID,
    patch: Partial<Pick<SantaEvent, 'name' | 'description' | 'date' | 'budget' | 'currency'>>,
  ) => void;
  deleteEvent: (id: ID) => void;
  archiveEvent: (id: ID, archived: boolean) => void;
  nextRound: (id: ID) => ID | null;
  addParticipants: (id: ID, people: ImportedPerson[]) => { added: number; skipped: number };
  updateParticipant: (id: ID, pid: ID, patch: Partial<Omit<Participant, 'id'>>) => void;
  removeParticipant: (id: ID, pid: ID) => void;
  addExclusion: (id: ID, ex: Omit<Exclusion, 'id'>) => boolean;
  removeExclusion: (id: ID, exId: ID) => void;
  setRules: (id: ID, rules: Partial<DrawRules>) => void;
  runDraw: (id: ID) => DrawResult;
  resetDraw: (id: ID) => void;
  setNotified: (id: ID, pid: ID, value: boolean) => void;
  importEvents: (events: SantaEvent[]) => number;
  clearAll: () => void;
}

/** Applies a mutation to one event, stamping updatedAt and an optional audit entry. */
function mutate(events: SantaEvent[], id: ID, fn: (e: SantaEvent) => SantaEvent, audit?: [string, string?]) {
  return events.map((e) => {
    if (e.id !== id) return e;
    const next = fn(e);
    const entry = audit ? [{ id: uid(), at: now(), action: audit[0], detail: audit[1] }] : [];
    return { ...next, updatedAt: now(), audit: [...entry, ...next.audit].slice(0, 500) };
  });
}

/** Changing the roster or rules after a draw invalidates it. */
function invalidate(e: SantaEvent): SantaEvent {
  if (e.status !== 'drawn') return e;
  return { ...e, status: 'draft', assignments: [], notified: {}, drawnAt: undefined };
}

export const useEvents = create<State>()(
  persist(
    (set, get) => ({
      events: [],

      createEvent: (partial) => {
        const e = newEvent(partial);
        e.audit = [{ id: uid(), at: e.createdAt, action: 'Event created', detail: e.name }];
        set((s) => ({ events: [e, ...s.events] }));
        return e.id;
      },

      updateEvent: (id, patch) =>
        set((s) => ({
          events: mutate(s.events, id, (e) => ({ ...e, ...patch }), ['Event details updated']),
        })),

      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      archiveEvent: (id, archived) =>
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (e) => ({ ...e, status: archived ? 'archived' : e.assignments.length ? 'drawn' : 'draft' }),
            [archived ? 'Event archived' : 'Event restored'],
          ),
        })),

      nextRound: (id) => {
        const src = get().events.find((e) => e.id === id);
        if (!src) return null;
        const year = new Date().getFullYear() + 1;
        const e = newEvent({
          name: src.name.replace(/\b(19|20)\d{2}\b/, String(year)),
          description: src.description,
          budget: src.budget,
          currency: src.currency,
          rules: { ...src.rules },
          participants: src.participants.map((p) => ({ ...p, accessCode: accessCode() })),
          exclusions: src.exclusions.map((x) => ({ ...x })),
          history: src.assignments.length ? [...src.history, src.assignments] : [...src.history],
        });
        e.audit = [
          { id: uid(), at: e.createdAt, action: 'Event created from previous round', detail: src.name },
        ];
        set((s) => ({ events: [e, ...s.events] }));
        return e.id;
      },

      addParticipants: (id, people) => {
        const e = get().events.find((x) => x.id === id);
        if (!e) return { added: 0, skipped: people.length };
        const emails = new Set(e.participants.map((p) => p.email.toLowerCase()).filter(Boolean));
        const names = new Set(e.participants.map((p) => p.name.toLowerCase()));
        const fresh: Participant[] = [];
        for (const p of people) {
          const em = p.email.trim().toLowerCase();
          const nm = p.name.trim().toLowerCase();
          if (!nm || (em && emails.has(em)) || (!em && names.has(nm))) continue;
          if (em) emails.add(em);
          names.add(nm);
          fresh.push({
            id: uid('p'),
            name: p.name.trim(),
            email: p.email.trim(),
            department: p.department?.trim() || undefined,
            wishlist: p.wishlist?.trim() || undefined,
            accessCode: accessCode(),
          });
        }
        if (fresh.length)
          set((s) => ({
            events: mutate(
              s.events,
              id,
              (ev) => invalidate({ ...ev, participants: [...ev.participants, ...fresh] }),
              ['Participants added', fresh.length === 1 ? fresh[0]!.name : `${fresh.length} people`],
            ),
          }));
        return { added: fresh.length, skipped: people.length - fresh.length };
      },

      updateParticipant: (id, pid, patch) =>
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (e) => {
              const structural = 'department' in patch;
              const next = {
                ...e,
                participants: e.participants.map((p) => (p.id === pid ? { ...p, ...patch } : p)),
              };
              return structural && e.rules.avoidSameDepartment ? invalidate(next) : next;
            },
            ['Participant updated', patch.name ?? e_name(get().events, id, pid)],
          ),
        })),

      removeParticipant: (id, pid) =>
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (e) =>
              invalidate({
                ...e,
                participants: e.participants.filter((p) => p.id !== pid),
                exclusions: e.exclusions.filter((x) => x.giverId !== pid && x.receiverId !== pid),
              }),
            ['Participant removed', e_name(get().events, id, pid)],
          ),
        })),

      addExclusion: (id, ex) => {
        const e = get().events.find((x) => x.id === id);
        if (!e || ex.giverId === ex.receiverId) return false;
        const dup = e.exclusions.some(
          (x) =>
            (x.giverId === ex.giverId && x.receiverId === ex.receiverId) ||
            (x.mutual && x.giverId === ex.receiverId && x.receiverId === ex.giverId),
        );
        if (dup) return false;
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (ev) => invalidate({ ...ev, exclusions: [...ev.exclusions, { ...ex, id: uid('x') }] }),
            [
              'Exclusion added',
              `${e_name(s.events, id, ex.giverId)} ${ex.mutual ? '↔' : '→'} ${e_name(s.events, id, ex.receiverId)}`,
            ],
          ),
        }));
        return true;
      },

      removeExclusion: (id, exId) =>
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (e) => invalidate({ ...e, exclusions: e.exclusions.filter((x) => x.id !== exId) }),
            ['Exclusion removed'],
          ),
        })),

      setRules: (id, rules) =>
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (e) => {
              const next = { ...e, rules: { ...e.rules, ...rules } };
              // PIN protection only affects link generation, not who gets whom.
              const onlyPin = Object.keys(rules).every((k) => k === 'pinProtectedLinks');
              return onlyPin ? next : invalidate(next);
            },
            [
              'Draw rules changed',
              Object.entries(rules)
                .map(([k, v]) => `${k}=${v}`)
                .join(', '),
            ],
          ),
        })),

      runDraw: (id) => {
        const e = get().events.find((x) => x.id === id);
        if (!e) return { ok: false, reason: 'Event not found.' };
        const input = {
          participants: e.participants,
          exclusions: e.exclusions,
          rules: e.rules,
          history: e.history,
        };
        const result = draw(input);
        if (result.ok) {
          const errors = validateAssignments(input, result.assignments);
          if (errors.length) return { ok: false, reason: `Internal validation failed: ${errors.join(' ')}` };
          set((s) => ({
            events: mutate(
              s.events,
              id,
              (ev) => ({
                ...ev,
                assignments: result.assignments,
                status: 'drawn',
                drawnAt: now(),
                notified: {},
              }),
              ['Names drawn', `${result.assignments.length} assignments`],
            ),
          }));
        } else {
          set((s) => ({ events: mutate(s.events, id, (ev) => ev, ['Draw failed', result.reason]) }));
        }
        return result;
      },

      resetDraw: (id) =>
        set((s) => ({
          events: mutate(
            s.events,
            id,
            (e) => ({ ...e, assignments: [], status: 'draft', notified: {}, drawnAt: undefined }),
            ['Draw reset'],
          ),
        })),

      setNotified: (id, pid, value) =>
        set((s) => ({
          events: mutate(s.events, id, (e) => {
            const notified = { ...e.notified };
            if (value) notified[pid] = now();
            else delete notified[pid];
            return { ...e, notified };
          }),
        })),

      importEvents: (incoming) => {
        const existing = new Set(get().events.map((e) => e.id));
        const fresh = incoming.filter((e) => !existing.has(e.id));
        set((s) => ({ events: [...fresh, ...s.events] }));
        return fresh.length;
      },

      clearAll: () => set({ events: [] }),
    }),
    {
      name: 'secretsanta:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ events: s.events }),
    },
  ),
);

function e_name(events: SantaEvent[], id: ID, pid: ID): string {
  return events.find((e) => e.id === id)?.participants.find((p) => p.id === pid)?.name ?? 'Unknown';
}

/** Structural validation for imported backups — never trust file contents. */
export function parseBackup(json: string): SantaEvent[] {
  const data = JSON.parse(json) as unknown;
  const list = (Array.isArray(data) ? data : (data as { events?: unknown })?.events) as unknown;
  if (!Array.isArray(list)) throw new Error('Backup file does not contain any events.');
  return list.map((raw, i) => {
    const e = raw as Partial<SantaEvent>;
    if (typeof e.id !== 'string' || typeof e.name !== 'string' || !Array.isArray(e.participants))
      throw new Error(`Event #${i + 1} is invalid.`);
    const base = newEvent();
    return {
      ...base,
      ...e,
      rules: { ...DEFAULT_RULES, ...(e.rules ?? {}) },
      participants: e.participants.map((p) => ({ ...p, accessCode: p.accessCode || accessCode() })),
      exclusions: Array.isArray(e.exclusions) ? e.exclusions : [],
      assignments: Array.isArray(e.assignments) ? e.assignments : [],
      history: Array.isArray(e.history) ? e.history : [],
      notified: e.notified ?? {},
      audit: Array.isArray(e.audit) ? e.audit : [],
    } as SantaEvent;
  });
}

export const useEvent = (id: ID | undefined) => useEvents((s) => s.events.find((e) => e.id === id));
