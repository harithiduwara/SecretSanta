import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Assignment, DrawRules, Exclusion, ID, Participant, SantaEvent } from '../lib/types';
import { accessCode, uid } from '../lib/random';
import { draw, validateAssignments, type DrawResult } from '../lib/draw';
import type { ImportedPerson } from '../lib/csv';
import { cleanCountryCode } from '../lib/phone';
import {
  deriveVaultKey,
  isVault,
  newSalt,
  openVault,
  passwordProblem,
  sealVault,
  unlockVault,
  VAULT_ITERATIONS,
  VaultError,
  type Vault,
} from '../lib/vault';

export const DEFAULT_RULES: DrawRules = {
  mode: 'random',
  avoidSameDepartment: false,
  avoidPreviousPairs: true,
  avoidReciprocal: true,
  pinProtectedLinks: false,
};

export const STORAGE_KEY = 'secretsanta:v1';

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

/** In-memory key material for an unlocked, password-protected exchange. Never persisted. */
export interface UnlockedKey {
  key: CryptoKey;
  salt: string;
  iterations: number;
  createdAt: string;
}

interface State {
  /** Plain exchanges plus protected exchanges that are currently unlocked (decrypted in memory). */
  events: SantaEvent[];
  /** Encrypted copies of password-protected exchanges, keyed by exchange id. */
  vaults: Record<ID, Vault>;
  /** Keys for unlocked protected exchanges. Memory only: a reload or closed tab locks everything. */
  keys: Record<ID, UnlockedKey>;
  protectEvent: (id: ID, password: string) => Promise<void>;
  /** Throws VaultError when the password is wrong. */
  unlockEvent: (id: ID, password: string) => Promise<void>;
  lockEvent: (id: ID) => Promise<void>;
  lockAll: () => Promise<void>;
  changePassword: (id: ID, current: string, next: string) => Promise<void>;
  removeProtection: (id: ID, password: string) => Promise<void>;
  createEvent: (partial?: Partial<SantaEvent>) => ID;
  updateEvent: (
    id: ID,
    patch: Partial<
      Pick<SantaEvent, 'name' | 'description' | 'date' | 'budget' | 'currency' | 'phoneCountryCode'>
    >,
  ) => void;
  deleteEvent: (id: ID) => void;
  archiveEvent: (id: ID, archived: boolean) => void;
  /** Async because a round created from a protected exchange is encrypted before it is saved. */
  nextRound: (id: ID) => Promise<ID | null>;
  addParticipants: (id: ID, people: ImportedPerson[]) => { added: number; skipped: number };
  /** Returns false (and changes nothing) if the new email is already used by someone else. */
  updateParticipant: (id: ID, pid: ID, patch: Partial<Omit<Participant, 'id'>>) => boolean;
  removeParticipant: (id: ID, pid: ID) => void;
  addExclusion: (id: ID, ex: Omit<Exclusion, 'id'>) => boolean;
  removeExclusion: (id: ID, exId: ID) => void;
  setRules: (id: ID, rules: Partial<DrawRules>) => void;
  runDraw: (id: ID) => DrawResult;
  resetDraw: (id: ID) => void;
  setNotified: (id: ID, pid: ID, value: boolean) => void;
  importEvents: (events: SantaEvent[], vaults?: Vault[]) => number;
  clearAll: () => void;
}

// These helpers must be defined before the store: `merge` uses them while the store is being created
// (localStorage is read synchronously), and `const` declarations further down would not exist yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;

const sortEvents = (list: SantaEvent[]) =>
  [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

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
    (set, get) => {
      /**
       * Encrypts the exchange with `meta` and then commits the encrypted copy, the key and the audit entry in a
       * single update. There is never a moment where the exchange is held in memory as protected but has no
       * encrypted copy in storage (closing the tab then would lose it).
       */
      const commitProtected = async (id: ID, meta: UnlockedKey, audit: [string, string?]) => {
        const before = get().events.find((x) => x.id === id);
        if (!before) return;
        const updated = mutate([before], id, (ev) => ev, audit)[0]!;
        const vault = await sealVault(updated, meta.key, meta);
        sealedJson.set(id, JSON.stringify(updated));
        set((s) => ({
          // If the exchange changed while encrypting, keep the newer copy; the pipeline re-encrypts it.
          events: s.events.map((x) => (x.id === id && x === before ? updated : x)),
          vaults: { ...s.vaults, [id]: vault },
          keys: { ...s.keys, [id]: meta },
        }));
        await flushSeal(id);
      };

      return {
        events: [],
        vaults: {},
        keys: {},

        protectEvent: async (id, password) => {
          const problem = passwordProblem(password);
          if (problem) throw new VaultError(problem);
          if (!get().events.some((x) => x.id === id) || get().vaults[id]) return;
          const salt = newSalt();
          const key = await deriveVaultKey(password, salt, VAULT_ITERATIONS);
          await commitProtected(id, { key, salt, iterations: VAULT_ITERATIONS, createdAt: now() }, [
            'Password protection turned on',
          ]);
        },

        unlockEvent: async (id, password) => {
          const vault = get().vaults[id];
          if (!vault) throw new VaultError('This exchange is not password protected.');
          if (get().keys[id]) return;
          const { event, key } = await unlockVault(vault, password);
          sealedJson.set(id, JSON.stringify(event));
          set((s) => ({
            events: sortEvents([event, ...s.events.filter((e) => e.id !== id)]),
            keys: {
              ...s.keys,
              [id]: { key, salt: vault.salt, iterations: vault.iterations, createdAt: vault.createdAt },
            },
          }));
        },

        lockEvent: async (id) => {
          await flushSeal(id);
          set((s) => {
            if (!s.vaults[id]) return {};
            const keys = { ...s.keys };
            delete keys[id];
            return { events: s.events.filter((e) => e.id !== id), keys };
          });
          sealedJson.delete(id);
        },

        lockAll: async () => {
          await Promise.all(Object.keys(get().keys).map((id) => get().lockEvent(id)));
        },

        changePassword: async (id, current, next) => {
          const problem = passwordProblem(next);
          if (problem) throw new VaultError(problem);
          const vault = get().vaults[id];
          if (!vault || !get().keys[id]) throw new VaultError('Unlock the exchange first.');
          await flushSeal(id);
          await unlockVault(get().vaults[id]!, current); // verifies the current password
          const salt = newSalt();
          const key = await deriveVaultKey(next, salt, VAULT_ITERATIONS);
          await commitProtected(id, { key, salt, iterations: VAULT_ITERATIONS, createdAt: vault.createdAt }, [
            'Password changed',
          ]);
        },

        removeProtection: async (id, password) => {
          const vault = get().vaults[id];
          if (!vault) return;
          await flushSeal(id);
          const { event } = await unlockVault(get().vaults[id]!, password);
          set((s) => {
            const vaults = { ...s.vaults };
            const keys = { ...s.keys };
            delete vaults[id];
            delete keys[id];
            const current = s.events.find((e) => e.id === id) ?? event;
            return {
              vaults,
              keys,
              events: mutate(sortEvents([current, ...s.events.filter((e) => e.id !== id)]), id, (ev) => ev, [
                'Password protection turned off',
              ]),
            };
          });
          sealedJson.delete(id);
        },

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

        deleteEvent: (id) => {
          sealedJson.delete(id);
          set((s) => {
            const vaults = { ...s.vaults };
            const keys = { ...s.keys };
            delete vaults[id];
            delete keys[id];
            return { events: s.events.filter((e) => e.id !== id), vaults, keys };
          });
        },

        archiveEvent: (id, archived) =>
          set((s) => ({
            events: mutate(
              s.events,
              id,
              (e) => ({ ...e, status: archived ? 'archived' : e.assignments.length ? 'drawn' : 'draft' }),
              [archived ? 'Event archived' : 'Event restored'],
            ),
          })),

        nextRound: async (id) => {
          const src = get().events.find((e) => e.id === id);
          if (!src) return null;
          // Bump the year in the name ("Party 2025" → "Party 2026"); otherwise mark it as the next round.
          const name = /\b(19|20)\d{2}\b/.test(src.name)
            ? src.name.replace(/\b((?:19|20)\d{2})\b/, (y) => String(Number(y) + 1))
            : `${src.name} (next round)`;
          const e = newEvent({
            name,
            description: src.description,
            budget: src.budget,
            currency: src.currency,
            phoneCountryCode: src.phoneCountryCode,
            rules: { ...src.rules },
            participants: src.participants.map((p) => ({ ...p, accessCode: accessCode() })),
            exclusions: src.exclusions.map((x) => ({ ...x })),
            history: src.assignments.length ? [...src.history, src.assignments] : [...src.history],
          });
          e.audit = [
            { id: uid(), at: e.createdAt, action: 'Event created from previous round', detail: src.name },
          ];
          // A round created from a protected exchange is protected with the same password. It is encrypted
          // before it is added, so it is never stored (or lost) in an in-between state.
          const srcKey = get().keys[id];
          if (srcKey) {
            const meta = { ...srcKey, createdAt: e.createdAt };
            const vault = await sealVault(e, meta.key, meta);
            sealedJson.set(e.id, JSON.stringify(e));
            set((s) => ({
              events: [e, ...s.events],
              vaults: { ...s.vaults, [e.id]: vault },
              keys: { ...s.keys, [e.id]: meta },
            }));
          } else {
            set((s) => ({ events: [e, ...s.events] }));
          }
          return e.id;
        },

        addParticipants: (id, people) => {
          const e = get().events.find((x) => x.id === id);
          if (!e) return { added: 0, skipped: people.length };
          const emails = new Set(e.participants.map((p) => p.email.toLowerCase()).filter(Boolean));
          const names = new Set(e.participants.map((p) => p.name.toLowerCase()));
          const phones = new Set(e.participants.map((p) => p.phone).filter(Boolean));
          const fresh: Participant[] = [];
          for (const p of people) {
            const em = p.email.trim().toLowerCase();
            const nm = p.name.trim().toLowerCase();
            const ph = p.phone;
            // Same email or same phone means the same person; without either, fall back to the name.
            if (!nm || (em && emails.has(em)) || (ph && phones.has(ph)) || (!em && !ph && names.has(nm)))
              continue;
            if (em) emails.add(em);
            if (ph) phones.add(ph);
            names.add(nm);
            fresh.push({
              id: uid('p'),
              name: p.name.trim(),
              email: p.email.trim(),
              department: p.department?.trim() || undefined,
              wishlist: p.wishlist?.trim() || undefined,
              ...(ph ? { phone: ph } : {}),
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

        updateParticipant: (id, pid, patch) => {
          const e = get().events.find((x) => x.id === id);
          const cur = e?.participants.find((p) => p.id === pid);
          if (!e || !cur) return false;
          const email = patch.email?.trim().toLowerCase();
          if (email && e.participants.some((p) => p.id !== pid && p.email.toLowerCase() === email))
            return false;
          if (patch.phone && e.participants.some((p) => p.id !== pid && p.phone === patch.phone))
            return false;
          const norm = (d?: string) => d?.trim().toLowerCase() || '';
          // Only a real department change can alter who may draw whom.
          const structural = 'department' in patch && norm(patch.department) !== norm(cur.department);
          set((s) => ({
            events: mutate(
              s.events,
              id,
              (ev) => {
                const next = {
                  ...ev,
                  participants: ev.participants.map((p) => (p.id === pid ? { ...p, ...patch } : p)),
                };
                return structural && ev.rules.avoidSameDepartment ? invalidate(next) : next;
              },
              ['Participant updated', patch.name ?? cur.name],
            ),
          }));
          return true;
        },

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
            if (errors.length)
              return { ok: false, reason: `Internal validation failed: ${errors.join(' ')}` };
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

        importEvents: (incoming, vaults = []) => {
          const existing = new Set([...get().events.map((e) => e.id), ...Object.keys(get().vaults)]);
          const fresh = incoming.filter((e) => !existing.has(e.id));
          const freshVaults = vaults.filter((v) => !existing.has(v.id) && !fresh.some((e) => e.id === v.id));
          set((s) => ({
            events: sortEvents([...fresh, ...s.events]),
            vaults: { ...s.vaults, ...Object.fromEntries(freshVaults.map((v) => [v.id, v])) },
          }));
          return fresh.length + freshVaults.length;
        },

        clearAll: () => {
          sealedJson.clear();
          set({ events: [], vaults: {}, keys: {} });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Protected exchanges are only ever written in encrypted form.
      partialize: (s) => ({
        events: s.events.filter((e) => !s.vaults[e.id] && !s.keys[e.id]),
        vaults: s.vaults,
      }),
      // On load or when another tab saves: take stored data, but keep exchanges unlocked in this tab.
      merge: (persisted, current) => {
        const p = (isObj(persisted) ? persisted : {}) as { events?: unknown; vaults?: unknown };
        const vaults: Record<ID, Vault> = {};
        if (isObj(p.vaults)) for (const v of Object.values(p.vaults)) if (isVault(v)) vaults[v.id] = v;
        const plain = (Array.isArray(p.events) ? (p.events as SantaEvent[]) : []).filter(
          (e) => !vaults[e.id],
        );
        const keys: Record<ID, UnlockedKey> = {};
        for (const [id, k] of Object.entries(current.keys)) if (vaults[id]) keys[id] = k;
        const unlocked = current.events.filter((e) => keys[e.id]);
        return { ...current, events: sortEvents([...unlocked, ...plain]), vaults, keys };
      },
    },
  ),
);

/*
 * Sealing pipeline: whenever an unlocked protected exchange changes, re-encrypt it in the background.
 * Saves for one exchange run strictly in order, and each seals the latest state.
 */
const sealedJson = new Map<ID, string>();
const sealQueue = new Map<ID, Promise<void>>();

function queueSeal(id: ID) {
  const run = async () => {
    const s = useEvents.getState();
    const e = s.events.find((x) => x.id === id);
    const k = s.keys[id];
    if (!e || !k) return;
    const vault = await sealVault(e, k.key, k);
    // Don't resurrect a vault that was locked, deleted or unprotected while we were encrypting.
    if (useEvents.getState().keys[id] !== k) return;
    useEvents.setState((st) => ({ vaults: { ...st.vaults, [id]: vault } }));
  };
  const next: Promise<void> = (sealQueue.get(id) ?? Promise.resolve()).then(run, run).finally(() => {
    if (sealQueue.get(id) === next) sealQueue.delete(id);
  });
  sealQueue.set(id, next);
}

/** True while a protected exchange has changes that are still being encrypted. */
export const hasPendingSaves = () => sealQueue.size > 0;

/** Resolves once every pending save for this exchange has been encrypted. */
export async function flushSeal(id: ID): Promise<void> {
  let current: Promise<void> | undefined;
  while ((current = sealQueue.get(id))) await current.catch(() => {});
}

useEvents.subscribe((s) => {
  for (const e of s.events) {
    if (!s.keys[e.id]) continue;
    const json = JSON.stringify(e);
    if (sealedJson.get(e.id) === json) continue;
    sealedJson.set(e.id, json);
    queueSeal(e.id);
  }
});

/** After another tab saves, re-read the exchanges this tab has unlocked so both tabs agree. */
async function refreshUnlocked() {
  const { vaults, keys } = useEvents.getState();
  for (const [id, k] of Object.entries(keys)) {
    const vault = vaults[id];
    if (!vault) continue;
    try {
      const event = await openVault(vault, k.key);
      const json = JSON.stringify(event);
      if (sealedJson.get(id) === json) continue;
      sealedJson.set(id, json);
      useEvents.setState((s) => ({ events: s.events.map((e) => (e.id === id ? event : e)) }));
    } catch {
      // The password was changed in another tab: lock here too.
      void useEvents.getState().lockEvent(id);
    }
  }
}

function e_name(events: SantaEvent[], id: ID, pid: ID): string {
  return events.find((e) => e.id === id)?.participants.find((p) => p.id === pid)?.name ?? 'Unknown';
}

export interface Backup {
  events: SantaEvent[];
  vaults: Vault[];
}

/** Structural validation for imported backups — never trust file contents. */
export function parseBackup(json: string): Backup {
  const data = JSON.parse(json) as unknown;
  const list = (Array.isArray(data) ? data : (data as { events?: unknown })?.events) as unknown;
  const rawVaults = isObj(data) && !Array.isArray(data) ? (data as { vaults?: unknown }).vaults : undefined;
  const vaults = (
    Array.isArray(rawVaults) ? rawVaults : isObj(rawVaults) ? Object.values(rawVaults) : []
  ).filter(isVault);
  if (!Array.isArray(list) && !vaults.length) throw new Error('Backup file does not contain any events.');
  return { events: parseEvents(Array.isArray(list) ? list : []), vaults };
}

function parseEvents(list: unknown[]): SantaEvent[] {
  return list.map((raw, i) => {
    const e = raw as Partial<SantaEvent>;
    if (typeof e.id !== 'string' || typeof e.name !== 'string' || !Array.isArray(e.participants))
      throw new Error(`Event #${i + 1} is invalid.`);
    const base = newEvent();
    const participants: Participant[] = e.participants
      .filter((p) => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        ...p,
        email: typeof p.email === 'string' ? p.email : '',
        phone: typeof p.phone === 'string' && /^\+[1-9]\d{7,14}$/.test(p.phone) ? p.phone : undefined,
        accessCode: typeof p.accessCode === 'string' && p.accessCode ? p.accessCode : accessCode(),
      }));
    const ids = new Set(participants.map((p) => p.id));
    const validAssignments = (list: unknown): Assignment[] =>
      Array.isArray(list)
        ? (list as Assignment[]).filter((a) => isObj(a) && ids.has(a.giverId) && ids.has(a.receiverId))
        : [];
    return {
      ...base,
      ...e,
      rules: { ...DEFAULT_RULES, ...(e.rules ?? {}) },
      participants,
      exclusions: (Array.isArray(e.exclusions) ? e.exclusions : []).filter(
        (x) => isObj(x) && ids.has(x.giverId) && ids.has(x.receiverId),
      ),
      assignments: validAssignments(e.assignments),
      history: Array.isArray(e.history) ? e.history.map(validAssignments) : [],
      notified: isObj(e.notified) ? e.notified : {},
      audit: (Array.isArray(e.audit) ? e.audit : []).filter((a) => isObj(a) && typeof a.action === 'string'),
      status: e.status === 'archived' || e.status === 'drawn' ? e.status : 'draft',
      phoneCountryCode:
        cleanCountryCode(typeof e.phoneCountryCode === 'string' ? e.phoneCountryCode : '') || undefined,
    } as SantaEvent;
  });
}

// Keep multiple open tabs consistent: when another tab saves, reload from storage instead of later overwriting it.
if (typeof window !== 'undefined') {
  // Encryption takes a moment; warn before closing the tab in the middle of saving a protected exchange.
  window.addEventListener('beforeunload', (ev) => {
    if (hasPendingSaves()) ev.preventDefault();
  });
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) void Promise.resolve(useEvents.persist.rehydrate()).then(refreshUnlocked);
  });
}

export const useEvent = (id: ID | undefined) => useEvents((s) => s.events.find((e) => e.id === id));

/** Snapshot for export: plain exchanges as data, protected ones only in encrypted form. */
export async function exportSnapshot(ids?: ID[]): Promise<Backup> {
  await Promise.all(Object.keys(useEvents.getState().keys).map(flushSeal));
  const { events, vaults, keys } = useEvents.getState();
  const want = (id: ID) => !ids || ids.includes(id);
  return {
    events: events.filter((e) => want(e.id) && !vaults[e.id] && !keys[e.id]),
    vaults: Object.values(vaults).filter((v) => want(v.id)),
  };
}

export const isProtected = (s: Pick<State, 'vaults' | 'keys'>, id: ID) => !!(s.vaults[id] || s.keys[id]);
