import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, useEvents } from '../events';

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

  it('starts a next round carrying history', () => {
    const id = s().createEvent({ name: 'Party 2025' });
    s().addParticipants(
      id,
      ['A', 'B', 'C', 'D'].map((name) => ({ name, email: '' })),
    );
    s().runDraw(id);
    const next = s().nextRound(id)!;
    expect(ev(next).name).toBe(`Party ${new Date().getFullYear() + 1}`);
    expect(ev(next).history).toHaveLength(1);
    expect(ev(next).participants[0]!.accessCode).not.toBe(ev(id).participants[0]!.accessCode);
    expect(s().nextRound('missing')).toBeNull();
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
    expect(s().importEvents(parseBackup(json))).toBe(1);
    expect(s().importEvents(parseBackup(json))).toBe(0);
    expect(ev(id).name).toBe('Backup me');
    expect(() => parseBackup('{"foo":1}')).toThrow('does not contain');
    expect(() => parseBackup('[{"id":1}]')).toThrow('#1 is invalid');
  });
});
