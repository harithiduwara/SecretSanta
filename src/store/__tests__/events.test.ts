import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, STORAGE_KEY, useEvents } from '../events';

const s = () => useEvents.getState();
const ev = (id: string) => s().events.find((e) => e.id === id)!;

describe('events store', () => {
  beforeEach(() => s().clearAll());

  it('creates events and participants with dedupe', () => {
    const id = s().createEvent({ name: 'Test' });
    const r = s().addParticipants(id, [
      { name: 'A', email: 'a@x.co' },
      { name: 'B', email: 'A@X.CO' },
      { name: 'C', email: '' },
      { name: 'c', email: '' },
      { name: ' ', email: '' },
    ]);
    expect(r).toEqual({ added: 2, skipped: 3 });
    expect(ev(id).participants.map((p) => p.name)).toEqual(['A', 'C']);
    expect(ev(id).audit[0]!.action).toBe('Participants added');
  });

  it('draws, invalidates on roster change, and resets', () => {
    const id = s().createEvent();
    s().addParticipants(id, [
      { name: 'A', email: '' },
      { name: 'B', email: '' },
      { name: 'C', email: '' },
    ]);
    expect(s().runDraw(id).ok).toBe(true);
    expect(ev(id).status).toBe('drawn');
    s().setNotified(id, ev(id).participants[0]!.id, true);
    expect(Object.keys(ev(id).notified)).toHaveLength(1);
    s().setRules(id, { pinProtectedLinks: true });
    expect(ev(id).status).toBe('drawn'); // PIN does not invalidate
    s().addParticipants(id, [{ name: 'D', email: '' }]);
    expect(ev(id).status).toBe('draft');
    expect(ev(id).assignments).toHaveLength(0);
    s().runDraw(id);
    s().resetDraw(id);
    expect(ev(id).assignments).toHaveLength(0);
  });

  it('manages exclusions', () => {
    const id = s().createEvent();
    s().addParticipants(id, [
      { name: 'A', email: '' },
      { name: 'B', email: '' },
    ]);
    const [a, b] = ev(id).participants;
    expect(s().addExclusion(id, { giverId: a!.id, receiverId: a!.id, mutual: true })).toBe(false);
    expect(s().addExclusion(id, { giverId: a!.id, receiverId: b!.id, mutual: true })).toBe(true);
    expect(s().addExclusion(id, { giverId: b!.id, receiverId: a!.id, mutual: false })).toBe(false);
    s().removeParticipant(id, b!.id);
    expect(ev(id).exclusions).toHaveLength(0);
  });

  it('records failed draws in the audit log', () => {
    const id = s().createEvent();
    s().addParticipants(id, [{ name: 'Solo', email: '' }]);
    expect(s().runDraw(id).ok).toBe(false);
    expect(ev(id).audit[0]!.action).toBe('Draw failed');
  });

  it('starts a next round carrying history', async () => {
    const id = s().createEvent({ name: 'Party 2025' });
    s().addParticipants(
      id,
      ['A', 'B', 'C', 'D'].map((name) => ({ name, email: '' })),
    );
    s().runDraw(id);
    const next = (await s().nextRound(id))!;
    expect(ev(next).name).toBe('Party 2026'); // bumps the year in the name, regardless of today's date
    expect(ev((await s().nextRound(s().createEvent({ name: 'Team gifts' })))!).name).toBe(
      'Team gifts (next round)',
    );
    expect(ev(next).history).toHaveLength(1);
    expect(ev(next).participants[0]!.accessCode).not.toBe(ev(id).participants[0]!.accessCode);
    expect(await s().nextRound('missing')).toBeNull();
  });

  it('archives, restores, updates and deletes', () => {
    const id = s().createEvent();
    s().archiveEvent(id, true);
    expect(ev(id).status).toBe('archived');
    s().archiveEvent(id, false);
    expect(ev(id).status).toBe('draft');
    s().updateEvent(id, { budget: 50 });
    expect(ev(id).budget).toBe(50);
    s().deleteEvent(id);
    expect(s().events).toHaveLength(0);
  });

  it('round-trips backups and validates input', () => {
    const id = s().createEvent({ name: 'Backup me' });
    const json = JSON.stringify({ events: s().events });
    s().clearAll();
    expect(s().importEvents(parseBackup(json).events)).toBe(1);
    expect(s().importEvents(parseBackup(json).events)).toBe(0);
    expect(ev(id).name).toBe('Backup me');
    expect(() => parseBackup('{"foo":1}')).toThrow('does not contain');
    expect(() => parseBackup('[{"id":1}]')).toThrow('#1 is invalid');
  });

  it('rejects editing a participant to a duplicate email', () => {
    const id = s().createEvent();
    s().addParticipants(id, [
      { name: 'A', email: 'a@x.co' },
      { name: 'B', email: 'b@x.co' },
    ]);
    const b = ev(id).participants[1]!;
    expect(s().updateParticipant(id, b.id, { email: 'A@X.CO' })).toBe(false);
    expect(ev(id).participants[1]!.email).toBe('b@x.co');
    expect(s().updateParticipant(id, b.id, { email: 'bee@x.co' })).toBe(true);
  });

  it('only invalidates a draw when a department actually changes', () => {
    const id = s().createEvent();
    s().addParticipants(id, [
      { name: 'A', email: '', department: 'Eng' },
      { name: 'B', email: '', department: 'Sales' },
      { name: 'C', email: '', department: 'Ops' },
    ]);
    s().setRules(id, { avoidSameDepartment: true });
    expect(s().runDraw(id).ok).toBe(true);
    const a = ev(id).participants[0]!;
    // The edit form always sends `department`; an unchanged value must not reset the draw.
    s().updateParticipant(id, a.id, { department: ' eng ', wishlist: 'Books' });
    expect(ev(id).status).toBe('drawn');
    s().updateParticipant(id, a.id, { department: 'Finance' });
    expect(ev(id).status).toBe('draft');
  });

  it('survives malformed backups without crashing', () => {
    const {
      events: [e],
    } = parseBackup(
      JSON.stringify({
        events: [
          {
            id: 'e1',
            name: 'Bad',
            status: 'weird',
            participants: [null, 42, { id: 'p1', name: 'A' }, { id: 'p2', name: 'B', email: 'b@x.co' }],
            exclusions: [null, { id: 'x', giverId: 'p1', receiverId: 'ghost', mutual: true }],
            assignments: [{ giverId: 'p1', receiverId: 'p2' }, 'junk'],
            history: [[{ giverId: 'p2', receiverId: 'ghost' }]],
            notified: 'nope',
            audit: [null, { id: 'a', at: '', action: 'ok' }],
          },
        ],
      }),
    );
    expect(e!.participants.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(e!.participants[0]!.email).toBe('');
    expect(e!.exclusions).toEqual([]);
    expect(e!.assignments).toHaveLength(1);
    expect(e!.history).toEqual([[]]);
    expect(e!.notified).toEqual({});
    expect(e!.audit).toHaveLength(1);
    expect(e!.status).toBe('draft');
  });

  it('picks up changes saved by another browser tab', async () => {
    s().createEvent({ name: 'Mine' });
    const other = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    other.state.events[0].name = 'Renamed in other tab';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(other));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    await new Promise((r) => setTimeout(r, 0));
    expect(s().events[0]!.name).toBe('Renamed in other tab');
  });
});
